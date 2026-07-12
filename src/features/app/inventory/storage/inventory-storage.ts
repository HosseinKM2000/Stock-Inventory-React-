import { db } from "@/shared/lib/infrastructure/storage/db";
import type { Product } from "../types";

export const inventoryStorage = {
  getAll(): Promise<Product[]> {
    return db.inventoryItems.toArray() as Promise<Product[]>;
  },

  get(id: number): Promise<Product | undefined> {
    return db.inventoryItems.get(id) as Promise<Product | undefined>;
  },

  save(product: Product) {
    return db.inventoryItems.put(product);
  },

  saveMany(products: Product[]) {
    return db.inventoryItems.bulkPut(products);
  },

  remove(id: number) {
    return db.inventoryItems.delete(id);
  },

  clear() {
    return db.inventoryItems.clear();
  },
};
