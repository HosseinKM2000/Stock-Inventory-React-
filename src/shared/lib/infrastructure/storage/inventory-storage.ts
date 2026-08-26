import type { Product } from "@/features/app/inventory/types";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { accessState } from "@/shared/access/access-state";

function currentUserId() {
  return accessState.user()?.id;
}

export const inventoryStorage = {
  getAll(): Promise<Product[]> {
    const userId = currentUserId();
    if (!userId) return Promise.resolve([]);
    return db.inventoryItems.where("local_user_id").equals(userId).toArray() as Promise<Product[]>;
  },

  get(id: number): Promise<Product | undefined> {
    return db.inventoryItems.get(id).then((product) =>
      product?.local_user_id === currentUserId() ? product : undefined,
    ) as Promise<Product | undefined>;
  },

  save(product: Product) {
    const userId = currentUserId();
    if (!userId) throw new Error("برای دسترسی به محصولات باید وارد حساب شوید");
    return db.inventoryItems.put({ ...product, local_user_id: userId });
  },

  saveMany(products: Product[]) {
    const userId = currentUserId();
    if (!userId) throw new Error("برای دسترسی به محصولات باید وارد حساب شوید");
    return db.inventoryItems.bulkPut(
      products.map((product) => ({ ...product, local_user_id: userId })),
    );
  },

  remove(id: number) {
    return this.get(id).then((product) =>
      product ? db.inventoryItems.delete(id) : undefined,
    );
  },

  clear() {
    return this.getAll().then((products) =>
      db.inventoryItems.bulkDelete(products.map((product) => product.id)),
    );
  },
};
