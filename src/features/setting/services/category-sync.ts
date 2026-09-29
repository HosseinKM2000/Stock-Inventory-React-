import { ApiError } from "@/shared/api/api-error";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueStorage } from "@/shared/lib/infrastructure/storage/queue-storage";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import {
  registerInboundSyncHandler,
  registerSyncHandler,
  type SyncHandlerResult,
} from "@/shared/lib/infrastructure/sync/sync-service";
import { createCategory, deleteCategory, getCategories, updateCategory } from "../api/categories.api";
import type { Category } from "../types";
import { CATEGORY_ENTITY } from "./category.service";

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const results: SyncHandlerResult[] = [];
  for (const item of items) {
    try {
      let record: Category | undefined;
      if (item.action === "CREATE") {
        const value = item.payload as Category;
        record = await createCategory({ id: item.entityId, name: value.name, description: value.description });
      } else if (item.action === "UPDATE") {
        const value = item.payload as Category;
        record = await updateCategory(item.entityId, { name: value.name, description: value.description });
      } else {
        await deleteCategory(item.entityId);
      }
      if (record) await categoryStorage.save(record);
      results.push({ itemId: item.id, status: "applied" });
    } catch (error) {
      if (error instanceof ApiError && error.message === "SUBSCRIPTION_EXPIRED") {
        throw error;
      }
      if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) {
        throw error;
      }
      results.push({
        itemId: item.id,
        status: "fatal_error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

async function pull() {
  const server = await getCategories();
  const serverIds = new Set(server.map((category) => category.id));
  for (const local of await categoryStorage.getAll()) {
    const pending = await queueStorage.get(`${CATEGORY_ENTITY}-${local.id}`);
    if (!pending && !serverIds.has(local.id)) await categoryStorage.remove(local.id);
  }
  for (const category of server) {
    if (!(await queueStorage.get(`${CATEGORY_ENTITY}-${category.id}`))) {
      await categoryStorage.save(category);
    }
  }
}

export function registerCategorySync() {
  registerSyncHandler(CATEGORY_ENTITY, push);
  registerInboundSyncHandler(CATEGORY_ENTITY, pull);
}
