import { pushJsonBatch } from "@/features/app/inventory/api/sync.api";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { registerSyncHandler, type SyncHandlerResult } from "@/shared/lib/infrastructure/sync/sync-service";
import type { InventoryMovement } from "../types";
import { INVENTORY_MOVEMENT_ENTITY } from "./movement-service";
import { movementRepository } from "./movement-repository";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const response = await pushJsonBatch(items);
  const output: SyncHandlerResult[] = [];
  for (const result of response.results) {
    const item = items.find((candidate) => candidate.operationId === result.operation_id);
    if (!item) continue;
    const movement = item.payload as InventoryMovement;
    const record = result.record as { movement?: InventoryMovement; product?: import("@/features/app/inventory/types").Product } | null;
    if (result.status === "applied") {
      await movementRepository.save({ ...movement, ...record?.movement, sync_status: "accepted", updated_at: record?.movement?.updated_at ?? new Date().toISOString() });
      if (record?.product) await inventoryRepository.save(record.product);
    } else {
      await movementRepository.save({ ...movement, sync_status: result.status === "conflict" ? "conflict" : "rejected", updated_at: new Date().toISOString() });
    }
    output.push({ itemId: item.id, status: result.status, error: result.error });
  }
  return output;
}

export function registerMovementSync() {
  registerSyncHandler(INVENTORY_MOVEMENT_ENTITY, push);
}
