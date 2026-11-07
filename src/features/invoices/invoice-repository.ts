import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import type { Invoice } from "./types";

function scope() {
  const user = accessState.user();
  if (!user) throw new Error("برای مشاهده فاکتورها وارد حساب شوید.");
  return { actor: user.id, store: user.store_id ?? user.id };
}
function key(id: number) { const value = scope(); return `${value.actor}:${value.store}:${id}`; }
function scoped(value: Invoice): Invoice { const current = scope(); return { ...value, local_key: key(value.id), local_user_id: current.actor, local_store_id: current.store }; }

export const invoiceRepository = {
  async getAll() { const current = scope(); return db.invoices.where("[local_user_id+local_store_id]").equals([current.actor, current.store]).reverse().sortBy("posted_at") as Promise<Invoice[]>; },
  get(id: number) { return db.invoices.get(key(id)) as Promise<Invoice | undefined>; },
  save(value: Invoice) { return db.invoices.put(scoped(value)); },
  saveManyForScope(values: Invoice[], actor: number, store: number) {
    return db.invoices.bulkPut(values.map((value) => ({
      ...value, local_key: `${actor}:${store}:${value.id}`, local_user_id: actor, local_store_id: store,
    })));
  },
};
