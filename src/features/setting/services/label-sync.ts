import { apiFetch } from "@/shared/api/client";
import { labelStorage } from "@/shared/lib/infrastructure/storage/label-storage";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { registerInboundSyncHandler, registerSyncHandler, type SyncHandlerResult } from "@/shared/lib/infrastructure/sync/sync-service";
import { pushJsonBatch } from "@/features/app/inventory/api/sync.api";
import type { Label } from "../types";
import { LABEL_ENTITY } from "./label.service";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const response = await pushJsonBatch(items);
  const byOperation = new Map(items.map((item) => [item.operationId, item]));
  return response.results.flatMap((result) => {
    const item = byOperation.get(result.operation_id);
    return item ? [{ itemId: item.id, status: result.status, error: result.error }] : [];
  });
}

async function pull() {
  const server = await apiFetch<Label[]>("/labels");
  const serverIds = new Set(server.map((label) => label.id));
  for (const local of await labelStorage.getAll()) {
    if (!(await queueService.hasForEntity(LABEL_ENTITY, local.id)) && !serverIds.has(local.id)) {
      await labelStorage.remove(local.id);
    }
  }
  for (const label of server) {
    if (!(await queueService.hasForEntity(LABEL_ENTITY, label.id))) await labelStorage.save(label);
  }
}

export function registerLabelSync() {
  registerSyncHandler(LABEL_ENTITY, push);
  registerInboundSyncHandler(LABEL_ENTITY, pull);
}
