import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { accessState } from "@/shared/access/access-state";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";

import { inventoryRepository } from "./inventory.repository";

import type { Product, ProductInput, ProductListParams } from "../types";
import { validPackSize } from "../domain/packaging";
import { labelStorage } from "@/shared/lib/infrastructure/storage/label-storage";

export type BulkProductIntent = {
  categoryId?: number | null;
  priceIncrease?: number;
  lowStockAlert?: boolean;
  lowStockThreshold?: number;
};

export const PRODUCT_ENTITY = "product";

export function normalizeProductSearch(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fa");
}

function sanitize(product: Product): Product {
  // Local data is never trusted blindly — it may come from an older schema,
  // a corrupted record or a future import.
  const quantity = Number(product.quantity);

  const price = Number(product.price);

  const threshold = Number(product.low_stock_threshold);

  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;

  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 0;
  const packaged =
    product.catalog_product?.is_packaged === true &&
    validPackSize(product.catalog_product.pack_size);

  const status =
    safeQuantity <= 0
      ? "out_of_stock"
      : safeThreshold > 0 && safeQuantity <= safeThreshold
        ? "low_stock"
        : "in_stock";

  return {
    ...product,

    category_id: product.category_id ?? null,

    label_ids: Array.isArray(product.label_ids)
      ? [...new Set(product.label_ids.filter(Number.isSafeInteger))]
      : [],

    quantity: safeQuantity,

    price: Number.isFinite(price) ? Math.max(0, price) : 0,

    low_stock_threshold: safeThreshold,

    low_stock_alert: Boolean(product.low_stock_alert),

    is_hidden: Boolean(product.is_hidden),

    is_catalog_backed: Boolean(product.is_catalog_backed),

    catalog_product_id:
      Number(product.catalog_product_id) || product.catalog_product?.id || 0,

    catalog_product: product.catalog_product
      ? {
          ...product.catalog_product,
          is_packaged: packaged,
          pack_size: packaged ? product.catalog_product.pack_size : null,
        }
      : undefined,

    image_url: typeof product.image_url === "string" ? product.image_url : null,

    status,
  };
}

class InventoryService {
  async getAll(params: ProductListParams = {}): Promise<Product[]> {
    let products = (await inventoryRepository.getAll()).map(sanitize);

    // Visibility filtering is opt-in so exports and maintenance operations
    // still work with the complete inventory.
    if (params.include_hidden === false) {
      products = products.filter((product) => !product.is_hidden);
    }

    if (params.hide_catalog_products) {
      products = products.filter((product) => !product.is_catalog_backed);
    }

    // Search
    if (params.search) {
      const search = normalizeProductSearch(params.search);
      const labels = new Map((await labelStorage.getAll()).map((label) => [label.id, normalizeProductSearch(label.name)]));

      products = products.filter((product) => {
        const name = normalizeProductSearch(product.catalog_product?.name ?? "");

        const label = normalizeProductSearch(product.custom_label ?? "");

        const labelMatch = product.label_ids?.some((id) => labels.get(id)?.includes(search)) ?? false;
        return name.includes(search) || label.includes(search) || labelMatch;
      });
    }

    if (params.category_id != null) {
      products = products.filter((product) => product.category_id === params.category_id);
    }

    // Every inventory consumer gets deterministic newest-first ordering unless
    // it explicitly requests a different user-selected sort.
    const sort = params.sort ?? "newest";
    products = [...products].sort((a, b) => {
      switch (sort) {
        case "newest":
          return (
            new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime() ||
            b.id - a.id
          );

        case "oldest":
          return (
            new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime() ||
            a.id - b.id
          );

        case "price_high":
          return b.price - a.price;

        case "price_low":
          return a.price - b.price;

        case "quantity_high":
          return b.quantity - a.quantity;

        case "quantity_low":
          return a.quantity - b.quantity;

        default:
          return 0;
      }
    });

    return products;
  }

  async get(id: number): Promise<Product | undefined> {
    const product = await inventoryRepository.get(id);

    return product ? sanitize(product) : undefined;
  }

  async create(product: Product): Promise<Product> {
    accessState.requireWrite();
    accessState.requireInventoryCapacity((await inventoryRepository.getAll()).length);
    const record = sanitize(product);

    return localMutationStorage.inventory(async () => {
      await inventoryRepository.save(record);

      const saved = await inventoryRepository.get(record.id);
      if (!saved) throw new Error("product was not saved");

      await queueService.enqueue(PRODUCT_ENTITY, saved.id, "CREATE", saved);
      return saved;
    });
  }

  async createMany(products: Product[]): Promise<Product[]> {
    accessState.requireWrite();
    const existing = (await inventoryRepository.getAll()).length;
    accessState.requireInventoryCapacity(existing + products.length);
    const records = products.map(sanitize);
    return localMutationStorage.inventory(async () => {
      for (const record of records) {
        await inventoryRepository.save(record);
        await queueService.enqueue(PRODUCT_ENTITY, record.id, "CREATE", record);
      }
      return records;
    });
  }

  async bulkUpdate(ids: readonly number[], intent: BulkProductIntent): Promise<Product[]> {
    accessState.requireWrite();
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) throw new Error("هیچ محصولی انتخاب نشده است");
    if (intent.priceIncrease !== undefined &&
        (!Number.isSafeInteger(intent.priceIncrease) || intent.priceIncrease < 0)) {
      throw new Error("افزایش قیمت باید عدد صحیح و نامنفی باشد");
    }
    if (intent.lowStockThreshold !== undefined &&
        (!Number.isSafeInteger(intent.lowStockThreshold) || intent.lowStockThreshold < 0)) {
      throw new Error("حد هشدار باید عدد صحیح و نامنفی باشد");
    }
    const hasEffectiveChange = intent.categoryId !== undefined ||
      (intent.priceIncrease ?? 0) > 0 || intent.lowStockAlert !== undefined ||
      intent.lowStockThreshold !== undefined;
    if (!hasEffectiveChange) throw new Error("حداقل یک تغییر مؤثر انتخاب کنید");

    return localMutationStorage.inventory(async () => {
      const updated: Product[] = [];
      for (const id of uniqueIds) {
        const current = await inventoryRepository.get(id);
        if (!current) continue;
        const price = intent.priceIncrease
          ? current.price + intent.priceIncrease
          : current.price;
        if (!Number.isSafeInteger(price)) throw new Error("قیمت نهایی از محدوده مجاز خارج است");
        const next = sanitize({
          ...current,
          ...(intent.categoryId !== undefined ? { category_id: intent.categoryId } : {}),
          ...(intent.lowStockAlert !== undefined ? { low_stock_alert: intent.lowStockAlert } : {}),
          ...(intent.lowStockThreshold !== undefined ? { low_stock_threshold: intent.lowStockThreshold } : {}),
          price,
          updated_at: new Date().toISOString(),
        });
        await inventoryRepository.save(next);
        await queueService.enqueue(PRODUCT_ENTITY, id, "UPDATE", next);
        updated.push(next);
      }
      if (updated.length === 0) throw new Error("محصول انتخاب‌شده دیگر در دسترس نیست");
      return updated;
    });
  }

  async update(id: number, input: ProductInput): Promise<Product> {
    accessState.requireWrite();
    const current = await inventoryRepository.get(id);

    if (!current) {
      throw new Error("product not found");
    }

    const updated = sanitize({
      ...current,

      ...input,

      updated_at: new Date().toISOString(),
    } as Product);

    const saved = await localMutationStorage.inventory(async () => {
      await inventoryRepository.save(updated);

      const persisted = await inventoryRepository.get(id);
      if (!persisted) throw new Error("update failed");

      await queueService.enqueue(PRODUCT_ENTITY, id, "UPDATE", persisted);
      return persisted;
    });

    if (current.image_url && current.image_url !== saved.image_url) {
      // OPFS cannot participate in an IndexedDB transaction. Metadata and the
      // outbox commit first; orphan cleanup is recoverable on the next start.
      try {
        await imageService.remove(current.image_url);
      } catch {
        // cleanupImages retries orphan removal on the next application start
      }
    }

    return saved;
  }

  async adjustQuantity(id: number, delta: number): Promise<Product> {
    accessState.requireWrite();

    if (!Number.isSafeInteger(delta) || delta === 0) {
      throw new Error("تغییر موجودی باید یک عدد صحیح و غیر صفر باشد");
    }

    const current = await inventoryRepository.get(id);

    if (!current || current.deleted_at) {
      throw new Error("محصول برای تغییر موجودی در دسترس نیست");
    }

    const currentQuantity = Number(current.quantity);

    if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0) {
      throw new Error("موجودی فعلی محصول معتبر نیست");
    }

    const quantity = currentQuantity + delta;

    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new Error("موجودی نهایی محصول معتبر نیست");
    }

    // Apply the confirmed delta to the latest local record. This preserves a
    // newer local quantity instead of overwriting it with a stale preview.
    return this.update(id, { quantity });
  }

  async remove(id: number): Promise<void> {
    accessState.requireWrite();
    const current = await inventoryRepository.get(id);

    if (!current) {
      throw new Error("محصول یافت نشد");
    }

    if (current.is_catalog_backed) {
      throw new Error(
        "محصولات کاتالوگی قابل حذف نیستند. می‌توانید آن‌ها را مخفی کنید.",
      );
    }

    await localMutationStorage.inventory(async () => {
      await inventoryRepository.remove(id);
      await queueService.enqueue(PRODUCT_ENTITY, id, "DELETE", null);
    });

    // The durable delete is authoritative. A failed OPFS cleanup is retried by
    // cleanupImages and must not turn a committed local mutation into failure.
    try {
      await imageService.remove(current.image_url);
    } catch {
      // cleanupImages retries orphan removal on the next application start
    }
  }

  /** Removes OPFS files that no product references any more. */
  async cleanupImages(): Promise<string[]> {
    const products = await inventoryRepository.getAllStored();

    return imageService.removeOrphans(
      products.map((product) => product.image_url),
      { purpose: "product" },
    );
  }
}

export const inventoryService = new InventoryService();
