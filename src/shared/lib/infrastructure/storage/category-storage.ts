import type { Category } from "@/features/setting/types";
import { accessState } from "@/shared/access/access-state";
import { db } from "./db";

const scope = () => { const user = accessState.user(); return user ? { actor: user.id, store: user.store_id ?? user.id } : null; };
const key = (id: number) => { const value = scope(); return value ? `${value.actor}:${value.store}:${id}` : ""; };
const scoped = (item: Category): Category => { const value = scope(); if (!value) throw new Error("برای دسترسی به دسته‌ها باید وارد حساب شوید"); return { ...item, local_user_id: value.actor, local_store_id: value.store, local_key: key(item.id) }; };

export const categoryStorage = {
  async getAll() { const value = scope(); if (!value) return []; const items = await db.categories.where("[local_user_id+local_store_id]").equals([value.actor, value.store]).toArray(); return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id); },
  get: (id: number) => db.categories.get(key(id)),
  save: (item: Category) => db.categories.put(scoped(item)),
  saveMany: (items: Category[]) => db.categories.bulkPut(items.map(scoped)),
  async replaceAll(items: Category[]) { const existing = await this.getAll(); await db.categories.bulkDelete(existing.flatMap((item) => item.local_key ? [item.local_key] : [])); await db.categories.bulkPut(items.map(scoped)); },
  async remove(id: number) { const item = await this.get(id); if (item?.local_key) await db.categories.delete(item.local_key); },
};
