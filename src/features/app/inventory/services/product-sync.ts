import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import { conflictPolicy } from "@/shared/lib/infrastructure/sync/conflict-policy";
import { registerSyncHandler } from "@/shared/lib/infrastructure/sync/sync-service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../api/products.api";

import { inventoryRepository } from "./inventory.repository";
import { PRODUCT_ENTITY } from "./inventory-service";

import type { Product, ProductInput } from "../types";

async function toInput(product: Product): Promise<ProductInput> {
  const input: ProductInput = {
    name: product.catalog_product?.name ?? product.custom_label ?? undefined,

    price: product.price,

    quantity: product.quantity,

    description: product.note ?? null,

    low_stock_alert: product.low_stock_alert,

    low_stock_threshold: product.low_stock_threshold,
  };

  if (product.image_url) {
    try {
      input.image = await imageService.read(product.image_url);
    } catch {
      // The binary vanished — push the record without it rather than blocking.
    }
  } else {
    input.remove_image = true;
  }

  return input;
}

/**
 * Applies the server response locally, letting the conflict policy decide
 * whether the server payload may overwrite the local record.
 */
async function reconcile(localId: number, server: Product) {
  const local = await inventoryRepository.get(localId);

  if (!local) {
    await inventoryRepository.save(server);

    return;
  }

  const winner =
    conflictPolicy.resolve(local, server) === "local"
      ? { ...server, ...local, id: server.id }
      : { ...local, ...server };

  await inventoryRepository.replaceId(localId, winner);
}

async function handle(item: SyncQueueItem) {
  if (item.action === "DELETE") {
    await deleteProduct(item.entityId);

    return;
  }

  const local = await inventoryRepository.get(item.entityId);

  if (!local) return;

  const input = await toInput(local);

  const server =
    item.action === "CREATE"
      ? await createProduct(input)
      : await updateProduct(item.entityId, input);

  await reconcile(item.entityId, server);
}

export function registerProductSync() {
  registerSyncHandler(PRODUCT_ENTITY, handle);
}
