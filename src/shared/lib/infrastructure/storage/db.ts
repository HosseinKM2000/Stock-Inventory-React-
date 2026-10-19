import Dexie, { type EntityTable } from "dexie";

import type {
  SyncMetadataItem,
  SyncQueueItem,
} from "./types";
import type { LocalInventoryItem } from "@/features/app/inventory/storage/types";
import type { Category } from "@/features/setting/types";
import type { Label } from "@/features/setting/types";
import type { BackupSettings } from "@/features/backup/types";
import type { InventoryMovement, ProductBarcode } from "@/features/barcode/types";

export function migrateLegacyProductPricing(item: LocalInventoryItem) {
  if (item.sale_price === undefined) item.sale_price = item.price_missing ? null : item.price;
  item.purchase_price ??= null;
  item.price = item.sale_price ?? 0;
  item.price_missing = item.sale_price == null;
  return item;
}

export function migrateLegacyQueuedPricing(item: SyncQueueItem) {
  if (item.entity !== "product" || !item.payload || typeof item.payload !== "object") return item;
  const payload = item.payload as Record<string, unknown>;
  if (!("sale_price" in payload) && "price" in payload) payload.sale_price = payload.price_missing === true ? null : payload.price;
  return item;
}


class AppDatabase extends Dexie {

  inventoryItems!: EntityTable<
    LocalInventoryItem,
    "local_key"
  >;

  syncQueue!: EntityTable<
    SyncQueueItem,
    "id"
  >;

  syncMetadata!: EntityTable<SyncMetadataItem, "key">;

  categories!: EntityTable<Category, "local_key">;
  labels!: EntityTable<Label, "local_key">;

  backupSettings!: EntityTable<BackupSettings, "userId">;
  barcodes!: EntityTable<ProductBarcode, "local_key">;
  inventoryMovements!: EntityTable<InventoryMovement, "local_key">;


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

    this.version(6).stores({
      inventoryItems: "id, local_user_id, catalog_product_id, category_id, updated_at",
      syncQueue: "id, ownerUserId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "id, local_user_id, name, updated_at",
      labels: "id, local_user_id, normalized_name, updated_at",
    });

    this.version(7).stores({
      inventoryItems: "id, local_user_id, catalog_product_id, category_id, updated_at",
      syncQueue: "id, ownerUserId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "id, local_user_id, name, updated_at",
      labels: "id, local_user_id, normalized_name, updated_at",
      backupSettings: "userId, mode, nextAttemptAt",
    });

    this.version(8).stores({
      inventoryItems: "local_key, id, [local_user_id+local_store_id], catalog_product_id, category_id, updated_at",
      syncQueue: "id, ownerUserId, storeId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "local_key, id, [local_user_id+local_store_id], name, updated_at",
      labels: "local_key, id, [local_user_id+local_store_id], normalized_name, updated_at",
      backupSettings: "userId, mode, nextAttemptAt",
    }).upgrade(async (transaction) => {
      let cached: { id?: number; store_id?: number } | null = null;
      try { cached = JSON.parse(localStorage.getItem("inventory-last-user") ?? "null"); } catch { cached = null; }
      for (const tableName of ["inventoryItems", "categories", "labels"]) {
        await transaction.table(tableName).toCollection().modify((item) => {
          const actor = item.local_user_id ?? cached?.id;
          const store = item.local_store_id ?? (actor === cached?.id ? cached?.store_id : undefined);
          item.local_user_id = actor;
          item.local_store_id = store;
          item.local_key = `${actor ?? "legacy"}:${store ?? "legacy"}:${item.id}`;
        });
      }
      await transaction.table<SyncQueueItem>("syncQueue").toCollection().modify((item) => {
        if (item.ownerUserId === cached?.id) item.storeId ??= cached?.store_id;
      });
    });

    this.version(9).stores({
      inventoryItems: "local_key, id, [local_user_id+local_store_id], catalog_product_id, category_id, updated_at",
      syncQueue: "id, ownerUserId, storeId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "local_key, id, [local_user_id+local_store_id], name, updated_at",
      labels: "local_key, id, [local_user_id+local_store_id], normalized_name, updated_at",
      backupSettings: "userId, mode, nextAttemptAt",
      barcodes: "local_key, id, [local_user_id+local_store_id], [local_user_id+local_store_id+value], product_id, value, updated_at",
      inventoryMovements: "local_key, id, [local_user_id+local_store_id], operation_id, product_id, reverses_operation_id, created_at",
    });

    this.version(10).stores({
      inventoryItems: "local_key, id, [local_user_id+local_store_id], catalog_product_id, category_id, updated_at",
      syncQueue: "id, ownerUserId, storeId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
      syncMetadata: "key, updatedAt",
      categories: "local_key, id, [local_user_id+local_store_id], name, updated_at",
      labels: "local_key, id, [local_user_id+local_store_id], normalized_name, updated_at",
      backupSettings: "userId, mode, nextAttemptAt",
      barcodes: "local_key, id, [local_user_id+local_store_id], [local_user_id+local_store_id+value], product_id, value, updated_at",
      inventoryMovements: "local_key, id, [local_user_id+local_store_id], operation_id, product_id, reverses_operation_id, created_at",
    }).upgrade(async (transaction) => {
      await transaction.table<LocalInventoryItem>("inventoryItems").toCollection().modify((item) => {
        migrateLegacyProductPricing(item);
      });
      await transaction.table<SyncQueueItem>("syncQueue").toCollection().modify((item) => {
        migrateLegacyQueuedPricing(item);
      });
    });

    const ensureLocalKey = (_primaryKey: unknown, item: { id: number; local_user_id?: number; local_store_id?: number; local_key?: string }) => {
      const actor = item.local_user_id;
      const store = item.local_store_id ?? actor;
      item.local_store_id ??= store;
      item.local_key ??= `${actor ?? "legacy"}:${store ?? "legacy"}:${item.id}`;
    };
    this.inventoryItems.hook("creating", ensureLocalKey);
    this.categories.hook("creating", ensureLocalKey);
    this.labels.hook("creating", ensureLocalKey);
    this.barcodes.hook("creating", ensureLocalKey);
    this.inventoryMovements.hook("creating", ensureLocalKey);
  }
}


export const db = new AppDatabase();
