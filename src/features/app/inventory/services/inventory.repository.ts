import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import type { Product } from "../types";

export const inventoryRepository = {
  getAll(): Promise<Product[]> {
    return inventoryStorage.getAll();
  },

  get(id: number): Promise<Product | undefined> {
    return inventoryStorage.get(id);
  },

  save(product: Product) {
    return inventoryStorage.save(product);
  },

  saveMany(products: Product[]) {
    return inventoryStorage.saveMany(products);
  },

  remove(id: number) {
    return inventoryStorage.remove(id);
  },

  /** Replaces a locally generated id with the identifier assigned by the server. */
  async replaceId(localId: number, product: Product) {
    if (localId !== product.id) {
      await inventoryStorage.remove(localId);
    }

    await inventoryStorage.save(product);
  },
};
