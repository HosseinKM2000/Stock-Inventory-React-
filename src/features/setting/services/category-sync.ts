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
import { assertSyncAccountCurrent, captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const account = captureSyncAccountContext();
  const response = await pushJsonBatch(items);
  assertSyncAccountCurrent(account);
  const byOperation = new Map(items.map((item) => [item.operationId, item]));
  const results: SyncHandlerResult[] = [];
  for (const result of response.results) {
    assertSyncAccountCurrent(account);
    const item = byOperation.get(result.operation_id);
    if (!item) continue;
    if (result.record && result.status === "applied") {
      const record = result.record as unknown as Category & { version?: number };
      const hasSuccessor = await queueService.hasSuccessor(item);
      assertSyncAccountCurrent(account);
      if (hasSuccessor && typeof record.version === "number") {
        await queueService.prepareSuccessorAfterAcknowledgement(item, record.version);
      }
      if (!hasSuccessor) await categoryStorage.save(record);
    }
    results.push({ itemId: item.id, status: result.status, error: result.error });
  }
  return results;
}

async function pull() {
  const account = captureSyncAccountContext();
  const server = await getCategories();
  assertSyncAccountCurrent(account);
  const serverIds = new Set(server.map((category) => category.id));
  for (const local of await categoryStorage.getAll()) {
    assertSyncAccountCurrent(account);
    const pending = await queueService.hasForEntity(CATEGORY_ENTITY, local.id);
    if (!pending && !serverIds.has(local.id)) await categoryStorage.remove(local.id);
  }
  for (const category of server) {
    assertSyncAccountCurrent(account);
    if (!(await queueService.hasForEntity(CATEGORY_ENTITY, category.id))) {
      await categoryStorage.save(category);
    }
  }
}

export function registerCategorySync() {
  registerSyncHandler(CATEGORY_ENTITY, push);
  registerInboundSyncHandler(CATEGORY_ENTITY, pull);
}
