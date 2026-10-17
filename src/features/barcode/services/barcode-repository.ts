import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import type { ProductBarcode } from "../types";

function scope() {
  const user = accessState.user();
  return user ? { actor: user.id, store: user.store_id ?? user.id } : null;
}

function key(id: number) {
  const current = scope();
  return current ? `${current.actor}:${current.store}:${id}` : "";
}

function scoped(value: ProductBarcode): ProductBarcode {
  const current = scope();
  if (!current) throw new Error("برای دسترسی به بارکدها باید وارد حساب شوید");
  return {
    ...value,
    local_user_id: current.actor,
    local_store_id: current.store,
    store_id: current.store,
    local_key: key(value.id),
  };
}

export const barcodeRepository = {
  getAll(): Promise<ProductBarcode[]> {
    const current = scope();
    return current
      ? db.barcodes.where("[local_user_id+local_store_id]").equals([current.actor, current.store]).toArray()
      : Promise.resolve([]);
  },
  get(id: number) {
    return db.barcodes.get(key(id));
  },
  async findByValue(value: string) {
    const current = scope();
    if (!current) return [];
    return db.barcodes
      .where("[local_user_id+local_store_id+value]")
      .equals([current.actor, current.store, value])
      .toArray();
  },
  async forProduct(productId: number) {
    return (await this.getAll()).filter((item) => item.product_id === productId);
  },
  save(value: ProductBarcode) {
    return db.barcodes.put(scoped(value));
  },
  saveMany(values: ProductBarcode[]) {
    return db.barcodes.bulkPut(values.map(scoped));
  },
  async remove(id: number) {
    await db.barcodes.delete(key(id));
  },
  async removeForProduct(productId: number) {
    const values = await this.forProduct(productId);
    await db.barcodes.bulkDelete(values.flatMap((item) => item.local_key ? [item.local_key] : []));
  },
};
