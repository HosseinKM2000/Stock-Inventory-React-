import type { Product } from "@/features/app/inventory/types";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { accessState } from "@/shared/access/access-state";

function scope() { const user = accessState.user(); return user ? { actor: user.id, store: user.store_id ?? user.id } : null; }
function localKey(id: number) { const current = scope(); return current ? `${current.actor}:${current.store}:${id}` : ""; }
function scoped(product: Product): Product { const current = scope(); if (!current) throw new Error("برای دسترسی به محصولات باید وارد حساب شوید"); return { ...product, local_user_id: current.actor, local_store_id: current.store, local_key: localKey(product.id) }; }

export const inventoryStorage = {
  getAll(): Promise<Product[]> { const current = scope(); return current ? db.inventoryItems.where("[local_user_id+local_store_id]").equals([current.actor, current.store]).toArray() as Promise<Product[]> : Promise.resolve([]); },
  getAllStored(): Promise<Product[]> { return db.inventoryItems.toArray() as Promise<Product[]>; },
  get(id: number): Promise<Product | undefined> { return db.inventoryItems.get(localKey(id)) as Promise<Product | undefined>; },
  save(product: Product) { return db.inventoryItems.put(scoped(product)); },
  saveMany(products: Product[]) { return db.inventoryItems.bulkPut(products.map(scoped)); },
  replaceAll(products: Product[]) { return db.transaction("rw", db.inventoryItems, async () => { const current = scope(); if (!current) throw new Error("برای دسترسی به محصولات باید وارد حساب شوید"); const keys = await db.inventoryItems.where("[local_user_id+local_store_id]").equals([current.actor, current.store]).primaryKeys(); await db.inventoryItems.bulkDelete(keys); await db.inventoryItems.bulkPut(products.map(scoped)); }); },
  async remove(id: number) { const item = await this.get(id); if (item?.local_key) await db.inventoryItems.delete(item.local_key); },
  async clear() { const items = await this.getAll(); await db.inventoryItems.bulkDelete(items.flatMap((item) => item.local_key ? [item.local_key] : [])); },
};
