import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import type { InventoryMovement } from "../types";

function scope() {
  const user = accessState.user();
  return user ? { actor: user.id, store: user.store_id ?? user.id } : null;
}

function key(id: number) {
  const current = scope();
  return current ? `${current.actor}:${current.store}:${id}` : "";
}

function scoped(value: InventoryMovement): InventoryMovement {
  const current = scope();
  if (!current) throw new Error("برای دسترسی به گردش موجودی باید وارد حساب شوید");
  return { ...value, local_user_id: current.actor, local_store_id: current.store, local_key: key(value.id) };
}

export const movementRepository = {
  getAll(): Promise<InventoryMovement[]> {
    const current = scope();
    return current
      ? db.inventoryMovements.where("[local_user_id+local_store_id]").equals([current.actor, current.store]).toArray()
      : Promise.resolve([]);
  },
  get(id: number) {
    return db.inventoryMovements.get(key(id));
  },
  async byOperationId(operationId: string) {
    return (await this.getAll()).find((item) => item.operation_id === operationId);
  },
  save(value: InventoryMovement) {
    return db.inventoryMovements.put(scoped(value));
  },
  saveMany(values: InventoryMovement[]) {
    return db.inventoryMovements.bulkPut(values.map(scoped));
  },
};
