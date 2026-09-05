import Dexie, { type EntityTable } from "dexie";

import type {
  SyncMetadataItem,
  SyncQueueItem,
} from "./types";
import type { LocalInventoryItem } from "@/features/app/inventory/storage/types";
import type { Category } from "@/features/setting/types";


class AppDatabase extends Dexie {

  inventoryItems!: EntityTable<
    LocalInventoryItem,
    "id"
  >;

  syncQueue!: EntityTable<
    SyncQueueItem,
    "id"
  >;

  syncMetadata!: EntityTable<SyncMetadataItem, "key">;

  categories!: EntityTable<Category, "id">;


  constructor() {

    super("inventory-db");


    this.version(1).stores({

      inventoryItems:
        "id, catalog_product_id, updated_at",

      syncQueue:
        "id, entity, entityId, updatedAt",

    });


    this.version(2)
      .stores({

        inventoryItems:
          "id, catalog_product_id, updated_at",

        syncQueue:
          "id, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",

      })
      .upgrade(async (transaction) => {

        await transaction
          .table<SyncQueueItem>("syncQueue")
          .toCollection()
          .modify((item) => {

            const legacyAction = item.action as string;

            item.action =
              legacyAction === "UPSERT" ? "UPDATE" : item.action;

            item.createdAt = item.createdAt ?? item.updatedAt ?? Date.now();

            item.retryCount = item.retryCount ?? 0;

            item.status = item.status ?? "pending";

            item.nextAttemptAt = item.nextAttemptAt ?? 0;

          });

      });

    this.version(3)
      .stores({
        inventoryItems: "id, catalog_product_id, updated_at",
        syncQueue:
          "id, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
        syncMetadata: "key, updatedAt",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<SyncQueueItem>("syncQueue")
          .toCollection()
          .modify((item) => {
            item.operationId = item.operationId ?? crypto.randomUUID();

            const legacyStatus = item.status as string;
            item.status =
              legacyStatus === "failed"
                ? "retryable_error"
                : legacyStatus === "processing" || legacyStatus === "in_flight"
                  ? "pending"
                  : item.status;
          });
      });

    this.version(4).stores({
      inventoryItems: "id, catalog_product_id, category_id, updated_at",
      syncQueue:
        "id, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "id, name, updated_at",
    });

    this.version(5)
      .stores({
        inventoryItems: "id, local_user_id, catalog_product_id, category_id, updated_at",
        syncQueue:
          "id, ownerUserId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
        syncMetadata: "key, updatedAt",
        categories: "id, local_user_id, name, updated_at",
      })
      .upgrade(async (transaction) => {
        let lastUserId: number | undefined;
        try {
          const stored = JSON.parse(localStorage.getItem("inventory-last-user") ?? "null") as { id?: number } | null;
          lastUserId = stored?.id;
        } catch {
          lastUserId = undefined;
        }

        if (!lastUserId) return;

        await transaction
          .table<LocalInventoryItem>("inventoryItems")
          .toCollection()
          .modify((item) => {
            item.local_user_id ??= lastUserId;
          });
        await transaction
          .table<SyncQueueItem>("syncQueue")
          .toCollection()
          .modify((item) => {
            item.ownerUserId ??= lastUserId;
          });
        await transaction
          .table<Category>("categories")
          .toCollection()
          .modify((item) => {
            item.local_user_id ??= lastUserId;
          });
      });
  }
}


export const db = new AppDatabase();
