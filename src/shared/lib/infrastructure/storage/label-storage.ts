import type { Label } from "@/features/setting/types";
import { accessState } from "@/shared/access/access-state";
import { db } from "./db";

const scope = () => { const user = accessState.user(); return user ? { actor: user.id, store: user.store_id ?? user.id } : null; };
const key = (id: number) => { const value = scope(); return value ? `${value.actor}:${value.store}:${id}` : ""; };
const scoped = (item: Label): Label => { const value = scope(); if (!value) throw new Error("برای ذخیره برچسب باید وارد حساب شوید"); return { ...item, local_user_id: value.actor, local_store_id: value.store, local_key: key(item.id) }; };

export const labelStorage = {
  async getAll() { const value = scope(); return value ? db.labels.where("[local_user_id+local_store_id]").equals([value.actor, value.store]).sortBy("name") : []; },
  get: (id: number) => db.labels.get(key(id)),
  save: (item: Label) => db.labels.put(scoped(item)),
  async remove(id: number) { const item = await this.get(id); if (item?.local_key) await db.labels.delete(item.local_key); },
};
