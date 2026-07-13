import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import type { Product } from "../types";

export const inventoryRepository = {
  getAll(): Promise<Product[]> {
    return inventoryStorage.getAll();
  },

  get(id: number): Promise<Product | undefined> {
    console.log("this is result of storage =>", inventoryStorage.get(id));
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
};
