import Dexie, { type EntityTable } from "dexie";

import type {
  SyncMetadataItem,
  SyncQueueItem,
} from "./types";
import type { LocalInventoryItem } from "@/features/app/inventory/storage/types";


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
  }
}


export const db = new AppDatabase();
