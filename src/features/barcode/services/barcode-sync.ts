import { fetchBarcodeSnapshot, pushJsonBatch } from "@/features/app/inventory/api/sync.api";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { registerInboundSyncHandler, registerSyncHandler, type SyncHandlerResult } from "@/shared/lib/infrastructure/sync/sync-service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import type { ProductBarcode } from "../types";
import { barcodeRepository } from "./barcode-repository";
import { BARCODE_ENTITY } from "./barcode-service";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const response = await pushJsonBatch(items);
  const output: SyncHandlerResult[] = [];
  for (const result of response.results) {
    const item = items.find((candidate) => candidate.operationId === result.operation_id);
    if (!item) continue;
    if (result.record && result.status === "applied") {
      await barcodeRepository.save(result.record as unknown as ProductBarcode);
    }
    output.push({ itemId: item.id, status: result.status, error: result.error });
  }
  return output;
}

async function pull() {
  const { items } = await fetchBarcodeSnapshot();
  const pending = new Set((await queueService.getAll()).filter((item) => item.entity === BARCODE_ENTITY).map((item) => item.entityId));
  const serverIds = new Set(items.map((item) => item.id));
  for (const local of await barcodeRepository.getAll()) {
    if (!serverIds.has(local.id) && !pending.has(local.id)) await barcodeRepository.remove(local.id);
  }
  await barcodeRepository.saveMany(items.filter((item) => !pending.has(item.id)));
}

export function registerBarcodeSync() {
  registerSyncHandler(BARCODE_ENTITY, push);
  registerInboundSyncHandler(BARCODE_ENTITY, pull);
}
