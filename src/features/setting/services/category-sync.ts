import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import {
  registerInboundSyncHandler,
  registerSyncHandler,
  type SyncHandlerResult,
} from "@/shared/lib/infrastructure/sync/sync-service";
import { getCategories } from "../api/categories.api";
import { pushJsonBatch } from "@/features/app/inventory/api/sync.api";
import type { Category } from "../types";
import { CATEGORY_ENTITY } from "./category.service";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const response = await pushJsonBatch(items);
  const byOperation = new Map(items.map((item) => [item.operationId, item]));
  const results: SyncHandlerResult[] = [];
  for (const result of response.results) {
    const item = byOperation.get(result.operation_id);
    if (!item) continue;
    if (result.record && result.status === "applied") await categoryStorage.save(result.record as unknown as Category);
    results.push({ itemId: item.id, status: result.status, error: result.error });
  }
  return results;
}

async function pull() {
  const server = await getCategories();
  const serverIds = new Set(server.map((category) => category.id));
  for (const local of await categoryStorage.getAll()) {
    const pending = await queueService.hasForEntity(CATEGORY_ENTITY, local.id);
    if (!pending && !serverIds.has(local.id)) await categoryStorage.remove(local.id);
  }
  for (const category of server) {
    if (!(await queueService.hasForEntity(CATEGORY_ENTITY, category.id))) {
      await categoryStorage.save(category);
    }
  }
}

export function registerCategorySync() {
  registerSyncHandler(CATEGORY_ENTITY, push);
  registerInboundSyncHandler(CATEGORY_ENTITY, pull);
}
