import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { accessState } from "@/shared/access/access-state";

import { inventoryRepository } from "./inventory.repository";

import type { Product, ProductInput, ProductListParams } from "../types";

export const PRODUCT_ENTITY = "product";

function sanitize(product: Product): Product {
  // Local data is never trusted blindly — it may come from an older schema,
  // a corrupted record or a future import.
  const quantity = Number(product.quantity);

  const price = Number(product.price);

  const threshold = Number(product.low_stock_threshold);

  const safeQuantity = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;

  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 0;

  const status =
    safeQuantity <= 0
      ? "out_of_stock"
      : safeThreshold > 0 && safeQuantity <= safeThreshold
        ? "low_stock"
        : "in_stock";

  return {
    ...product,

    category_id: product.category_id ?? null,

    quantity: safeQuantity,

    price: Number.isFinite(price) ? Math.max(0, price) : 0,

    low_stock_threshold: safeThreshold,

    low_stock_alert: Boolean(product.low_stock_alert),

    is_hidden: Boolean(product.is_hidden),

    image_url: typeof product.image_url === "string" ? product.image_url : null,

    status,
  };
}

class InventoryService {
  async getAll(params: ProductListParams = {}): Promise<Product[]> {
    let products = (await inventoryRepository.getAll()).map(sanitize);

    // Search
    if (params.search) {
      const search = params.search.trim().toLowerCase();

      products = products.filter((product) => {
        const name = product.catalog_product?.name?.toLowerCase() ?? "";

        const label = product.custom_label?.toLowerCase() ?? "";

        return name.includes(search) || label.includes(search);
      });
    }

    if (params.category_id != null) {
      products = products.filter((product) => product.category_id === params.category_id);
    }

    // Sort
    if (params.sort) {
      products = [...products].sort((a, b) => {
        switch (params.sort) {
          case "newest":
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );

          case "oldest":
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
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
    }

    return products;
  }

  async get(id: number): Promise<Product | undefined> {
    const product = await inventoryRepository.get(id);

    return product ? sanitize(product) : undefined;
  }

  async create(product: Product): Promise<Product> {
    accessState.requireWrite();
    const record = sanitize(product);

    await inventoryRepository.save(record);

    const saved = await inventoryRepository.get(record.id);
    if (!saved) {
      throw new Error("product was not saved");
    }

    await queueService.enqueue(PRODUCT_ENTITY, saved.id, "CREATE", saved);

    return saved;
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

    await inventoryRepository.save(updated);

    const saved = await inventoryRepository.get(id);

    if (!saved) {
      throw new Error("update failed");
    }

    if (current.image_url && current.image_url !== saved.image_url) {
      await imageService.remove(current.image_url);
    }

    await queueService.enqueue(PRODUCT_ENTITY, id, "UPDATE", saved);

    return saved;
  }

  async remove(id: number): Promise<void> {
    accessState.requireWrite();
    const current = await inventoryRepository.get(id);

    await inventoryRepository.remove(id);

    await imageService.remove(current?.image_url);

    await queueService.enqueue(PRODUCT_ENTITY, id, "DELETE", null);
  }

  /** Removes OPFS files that no product references any more. */
  async cleanupImages(): Promise<string[]> {
    const products = await inventoryRepository.getAll();

    return imageService.removeOrphans(
      products.map((product) => product.image_url),
    );
  }
}

export const inventoryService = new InventoryService();
