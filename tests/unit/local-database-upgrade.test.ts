import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "@/shared/lib/infrastructure/storage/db";

const names: string[] = [];
const schema10 = {
  inventoryItems: "local_key, id, [local_user_id+local_store_id], catalog_product_id, category_id, updated_at",
  syncQueue: "id, ownerUserId, storeId, operationId, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
  syncMetadata: "key, updatedAt",
  categories: "local_key, id, [local_user_id+local_store_id], name, updated_at",
  labels: "local_key, id, [local_user_id+local_store_id], normalized_name, updated_at",
  backupSettings: "userId, mode, nextAttemptAt",
  barcodes: "local_key, id, [local_user_id+local_store_id], [local_user_id+local_store_id+value], product_id, value, updated_at",
  inventoryMovements: "local_key, id, [local_user_id+local_store_id], operation_id, product_id, reverses_operation_id, created_at",
};
const schema12 = {
  ...schema10,
  syncQueue: "id, ownerUserId, storeId, operationId, resourceKey, attemptState, entity, entityId, status, nextAttemptAt, createdAt, updatedAt",
  recoverySessions: "id, ownerUserId, storeId, status, updatedAt",
  recoveryItems: "id, sessionId, [ownerUserId+storeId], classification, decision, entity, entityId, updatedAt",
};

function name(label: string) {
  const value = `upgrade-${label}-${crypto.randomUUID()}`;
  names.push(value);
  return value;
}

afterEach(async () => {
  for (const value of names.splice(0)) await Dexie.delete(value);
});

describe("local database upgrade rehearsal", () => {
  it("upgrades directly from v10 to v13 without changing operation identity or image references", async () => {
    const dbName = name("skip");
    const old = new Dexie(dbName);
    old.version(10).stores(schema10);
    await old.open();
    await old.table("inventoryItems").put({
      local_key: "7:11:41", id: 41, local_user_id: 7, local_store_id: 11,
      name: "کالای قدیمی", price: 120, sale_price: 120, purchase_price: null,
      price_missing: false, quantity: 3, image_url: "opfs://products/41.webp", updated_at: "2026-11-01T00:00:00Z",
    });
    const payload = { name: "ویرایش پایدار", image_url: "opfs://products/41.webp" };
    await old.table("syncQueue").put({
      id: "queue-1", ownerUserId: 7, storeId: 11, operationId: "operation-fixed",
      entity: "product", entityId: 41, action: "UPDATE", payload,
      status: "in_flight", retryCount: 0, nextAttemptAt: 0, createdAt: 1, updatedAt: 2,
      executionMode: "solo", policyVersion: 4,
    });
    old.close();

    const current = new AppDatabase(dbName);
    await current.open();
    const product = await current.inventoryItems.get("7:11:41");
    const operation = await current.syncQueue.get("queue-1");
    expect(product?.image_url).toBe("opfs://products/41.webp");
    expect(operation).toMatchObject({
      operationId: "operation-fixed", payload, attemptState: "uncertain",
      resourceKey: "product:41", executionMode: "solo", policyVersion: 4,
    });
    expect(current.tables.map((table) => table.name)).toContain("mediaTransfers");
    current.close();
  });

  it("preserves v12 recovery evidence while adding the durable transfer journal", async () => {
    const dbName = name("recovery");
    const old = new Dexie(dbName);
    old.version(12).stores(schema12);
    await old.open();
    await old.table("recoverySessions").put({
      id: "recovery-1", ownerUserId: 7, storeId: 11, status: "review",
      checkpoint: { marker: "checkpoint" }, imported: { marker: "imported" },
      media: [{ originalPath: "opfs://a.webp", stagedPath: "opfs://stage/a.webp", copied: true }],
      updatedAt: 2,
    });
    await old.table("recoveryItems").put({
      id: "item-1", sessionId: "recovery-1", ownerUserId: 7, storeId: 11,
      classification: "uncertain", decision: "pending", entity: "product", entityId: 41,
      originalOperation: { operationId: "original-operation", payload: { quantity: 2 } }, updatedAt: 2,
    });
    old.close();

    const current = new AppDatabase(dbName);
    await current.open();
    expect(await current.recoverySessions.get("recovery-1")).toMatchObject({
      checkpoint: { marker: "checkpoint" }, imported: { marker: "imported" },
    });
    expect(await current.recoveryItems.get("item-1")).toMatchObject({
      originalOperation: { operationId: "original-operation", payload: { quantity: 2 } },
    });
    current.close();
  });

  it("keeps the old transaction recoverable after a failed migration and reports a blocked tab", async () => {
    const dbName = name("failure");
    const old = new Dexie(dbName);
    old.version(10).stores(schema10);
    await old.open();
    await old.table("syncMetadata").put({ key: "preserved", value: "yes", updatedAt: 1 });
    old.close();

    const broken = new Dexie(dbName);
    broken.version(10).stores(schema10);
    broken.version(11).stores(schema12).upgrade(() => { throw new Error("synthetic migration failure"); });
    await expect(broken.open()).rejects.toThrow("synthetic migration failure");
    broken.close();

    const blockingTab = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const current = new AppDatabase(dbName);
    const blockedEvent = new Promise<void>((resolve) => current.on("blocked", () => resolve()));
    const opening = current.open();
    await blockedEvent;
    blockingTab.close();
    await opening;
    expect(await current.syncMetadata.get("preserved")).toMatchObject({ value: "yes" });
    current.close();
  });
});
