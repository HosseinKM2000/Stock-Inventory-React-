import { beforeEach, describe, expect, it } from "vitest";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueStorage } from "@/shared/lib/infrastructure/storage/queue-storage";
import type { User } from "@/features/auth/types";
import { product } from "../helpers/product";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import { isAccessDeniedOutcomeUnresolved, queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";

function user(id: number): User {
  return {
    id,
    first_name: "Test",
    last_name: String(id),
    username: `user-${id}`,
    email: null,
    phone: null,
    industry_id: null,
    plan: "free",
    is_active: true,
    is_admin: false,
    role: "USER",
    is_system_admin: false,
    subscription_started_at: null,
    subscription_expires_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("IndexedDB repositories", () => {
  beforeEach(async () => {
    accessState.clear();
    await db.open();
    await Promise.all([
      db.inventoryItems.clear(),
      db.categories.clear(),
      db.labels.clear(),
      db.syncQueue.clear(),
      db.syncMetadata.clear(),
    ]);
  });

  it("keeps a prior-attempt access denial as non-retrying unresolved evidence", async () => {
    accessState.saveUser({ ...user(1), store_id: 91, is_store_owner: true });
    await queueService.enqueue("product", 901, "UPDATE", { id: 901, quantity: 2 });
    const pending = (await queueService.getAll())[0];
    const claimed = await queueService.markInFlight(pending);
    expect(claimed).toBeDefined();

    await queueService.markAccessDeniedUnresolved(
      claimed!,
      new Error("STORE_MEMBERSHIP_INACTIVE"),
    );

    const preserved = (await queueService.getAll())[0];
    expect(preserved).toMatchObject({
      operationId: pending.operationId,
      payload: pending.payload,
      attemptState: "uncertain",
      status: "fatal_error",
      nextAttemptAt: Number.MAX_SAFE_INTEGER,
    });
    expect(isAccessDeniedOutcomeUnresolved(preserved)).toBe(true);
    expect(await queueService.getDue()).toEqual([]);
  });

  it("persists inventory across close/reopen and isolates it by user", async () => {
    accessState.saveUser(user(1));
    await inventoryStorage.save(product({ id: 101 }));
    db.close();
    await db.open();
    expect((await inventoryStorage.getAll()).map((item) => item.id)).toEqual([101]);

    accessState.saveUser(user(2));
    expect(await inventoryStorage.getAll()).toEqual([]);
    await inventoryStorage.save(product({ id: 202 }));

    accessState.saveUser(user(1));
    expect((await inventoryStorage.getAll()).map((item) => item.id)).toEqual([101]);
  });

  it("keeps separate projections for two people in the same store", async () => {
    accessState.saveUser({ ...user(11), store_id: 700, is_store_owner: true });
    await inventoryStorage.save(product({ id: 55, quantity: 10 }));

    accessState.saveUser({ ...user(12), store_id: 700, is_store_owner: false, store_permissions: ["products.view"] });
    expect(await inventoryStorage.get(55)).toBeUndefined();
    await inventoryStorage.save(product({ id: 55, quantity: 8 }));

    accessState.saveUser({ ...user(11), store_id: 700, is_store_owner: true });
    expect(await inventoryStorage.get(55)).toMatchObject({ quantity: 10 });
    expect(await db.inventoryItems.where("id").equals(55).count()).toBe(2);
  });

  it("keeps a bulk-edited product and its outbox payload durable across restart", async () => {
    accessState.saveUser({ ...user(1), is_admin: true, role: "ADMIN" });
    await inventoryStorage.save(product({
      id: 707,
      category_id: 3,
      quantity: 12,
      price: 900,
      label_ids: [4, 5],
      image_url: "local://durable.webp",
      is_hidden: false,
    }));

    await inventoryService.bulkUpdate([707], { priceIncrease: 100, lowStockAlert: false });
    db.close();
    await db.open();

    expect(await inventoryStorage.get(707)).toMatchObject({
      id: 707,
      category_id: 3,
      quantity: 12,
      price: 1000,
      label_ids: [4, 5],
      image_url: "local://durable.webp",
      is_hidden: false,
      low_stock_alert: false,
    });
    expect((await queueService.getForEntity("product", 707))[0]).toMatchObject({
      action: "CREATE",
      payload: expect.objectContaining({ id: 707, price: 1000, quantity: 12 }),
    });
  });

  it("replaceAll changes only the active user's inventory", async () => {
    accessState.saveUser(user(1));
    await inventoryStorage.save(product({ id: 1 }));
    accessState.saveUser(user(2));
    await inventoryStorage.save(product({ id: 2 }));
    await inventoryStorage.replaceAll([product({ id: 3 })]);
    expect((await inventoryStorage.getAll()).map((item) => item.id)).toEqual([3]);

    accessState.saveUser(user(1));
    expect((await inventoryStorage.getAll()).map((item) => item.id)).toEqual([1]);
  });

  it("sorts categories deterministically and prevents cross-user delete", async () => {
    accessState.saveUser(user(1));
    await categoryStorage.save({ id: 1, name: "Old", description: "", created_at: "2026-01-01Z", updated_at: "2026-01-01Z" });
    await categoryStorage.save({ id: 2, name: "New", description: "", created_at: "2026-02-01Z", updated_at: "2026-02-01Z" });
    expect((await categoryStorage.getAll()).map((item) => item.id)).toEqual([2, 1]);

    accessState.saveUser(user(2));
    await categoryStorage.remove(1);
    accessState.saveUser(user(1));
    expect(await categoryStorage.get(1)).toBeDefined();
  });

  it("scopes durable queue records and clear operations by owner", async () => {
    const record = (id: string) => ({
      id,
      operationId: `${id}-operation`,
      entity: "product",
      entityId: 1,
      action: "UPDATE" as const,
      payload: { quantity: 1 },
      createdAt: 1,
      updatedAt: 1,
      retryCount: 0,
      status: "pending" as const,
      nextAttemptAt: 0,
    });
    accessState.saveUser(user(1));
    await queueStorage.upsert(record("product-1"));
    db.close();
    await db.open();
    expect(await queueStorage.count()).toBe(1);
    accessState.saveUser(user(2));
    await queueStorage.upsert(record("product-1"));
    expect(await queueStorage.count()).toBe(1);
    await queueStorage.clear();

    accessState.saveUser(user(1));
    expect(await queueStorage.count()).toBe(1);
  });

  it("keeps an in-flight operation intact when a newer edit is queued", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 99, "CREATE", { quantity: 1 });
    const original = (await queueService.getDue())[0];
    const claimed = await queueService.markInFlight(original);
    expect(claimed?.status).toBe("in_flight");

    await queueService.enqueue("product", 99, "UPDATE", { quantity: 2 });
    const operations = await queueService.getForEntity("product", 99);
    expect(operations).toHaveLength(2);
    expect(operations.find((item) => item.status === "in_flight")?.operationId)
      .toBe(original.operationId);
    expect(operations.find((item) => item.status === "pending")?.payload)
      .toEqual({ quantity: 2 });
  });

  it("keeps a retryable attempted snapshot immutable when a newer edit is queued", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 98, "UPDATE", { quantity: 1, version: 1 });
    const original = (await queueService.getDue())[0];
    const claimed = await queueService.markInFlight(original);
    await queueService.markFailed(claimed!, new Error("response lost"));

    await queueService.enqueue("product", 98, "UPDATE", { quantity: 2, version: 1 });

    const operations = await queueService.getForEntity("product", 98);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({
      operationId: original.operationId,
      payload: { quantity: 1, version: 1 },
      status: "retryable_error",
    });
    expect(operations[1]).toMatchObject({
      payload: { quantity: 2, version: 1 },
      status: "pending",
    });
    expect(operations[1].operationId).not.toBe(original.operationId);
  });

  it("preserves and eventually applies edit B after operation A committed but its response was lost", async () => {
    accessState.saveUser(user(1));
    await inventoryStorage.save(product({ id: 89, quantity: 1, version: 1 }));
    await queueService.enqueue("product", 89, "UPDATE", { id: 89, quantity: 1, version: 1 });
    const operationA = (await queueService.getDue())[0];
    const dispatchedA = await queueService.markInFlight(operationA);
    await queueService.markFailed(dispatchedA!, new Error("response lost after commit"));

    await inventoryStorage.save(product({ id: 89, quantity: 2, version: 1 }));
    await queueService.enqueue("product", 89, "UPDATE", { id: 89, quantity: 2, version: 1 });
    const beforeRetry = await queueService.getForEntity("product", 89);
    const operationB = beforeRetry[1];
    expect(beforeRetry).toHaveLength(2);

    await queueStorage.upsert({ ...beforeRetry[0], nextAttemptAt: 0 });
    const retryA = (await queueService.getDue())[0];
    expect(retryA.operationId).toBe(operationA.operationId);
    const redispatchedA = await queueService.markInFlight(retryA);
    await queueService.prepareSuccessorAfterAcknowledgement(redispatchedA!, 2);
    await queueService.removeIfUnchanged(redispatchedA!);

    expect(await inventoryStorage.get(89)).toMatchObject({ quantity: 2 });
    expect(await queueService.getForEntity("product", 89)).toEqual([
      expect.objectContaining({
        operationId: operationB.operationId,
        payload: { id: 89, quantity: 2, version: 2 },
        status: "pending",
      }),
    ]);

    const dispatchedB = await queueService.markInFlight((await queueService.getDue())[0]);
    await inventoryStorage.save(product({ id: 89, quantity: 2, version: 2 }));
    await queueService.removeIfUnchanged(dispatchedB!);

    expect(await queueService.getForEntity("product", 89)).toEqual([]);
    expect(await inventoryStorage.get(89)).toMatchObject({ quantity: 2, version: 2 });
  });

  it("persists attempted identity across restart before an acknowledgement", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 93, "UPDATE", { quantity: 1, version: 1 });
    const original = (await queueService.getDue())[0];
    const claimed = await queueService.markInFlight(original);

    db.close();
    await db.open();
    await queueService.enqueue("product", 93, "UPDATE", { quantity: 2, version: 1 });

    const operations = await queueService.getForEntity("product", 93);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({
      operationId: claimed?.operationId,
      attemptState: "attempted",
      payload: { quantity: 1, version: 1 },
    });
  });

  it("does not let a same-resource successor overtake an expired attempted predecessor", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 97, "UPDATE", { quantity: 1, version: 1 });
    const original = (await queueService.getDue())[0];
    const claimed = await queueService.markInFlight(original);
    await queueService.enqueue("product", 97, "UPDATE", { quantity: 2, version: 1 });
    await queueStorage.upsert({ ...claimed!, nextAttemptAt: 0 });

    const due = await queueService.getDue();
    expect(due).toHaveLength(1);
    expect(due[0].operationId).toBe(original.operationId);
  });

  it("continues independent resources while one resource is blocked", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 92, "UPDATE", { quantity: 1 });
    const blocked = (await queueService.getDue())[0];
    await queueService.markConflict(blocked, "manual review");
    await queueService.enqueue("product", 92, "UPDATE", { quantity: 2 });
    await queueService.enqueue("product", 91, "UPDATE", { quantity: 3 });

    const due = await queueService.getDue();
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ entityId: 91, payload: { quantity: 3 } });
  });

  it("keeps a delete as a successor to an attempted edit", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 90, "UPDATE", { quantity: 1 });
    const original = (await queueService.getDue())[0];
    await queueService.markInFlight(original);
    await queueService.enqueue("product", 90, "DELETE", null);

    const operations = await queueService.getForEntity("product", 90);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({ action: "UPDATE", payload: { quantity: 1 } });
    expect(operations[1]).toMatchObject({ action: "DELETE", payload: null, attemptState: "never" });
  });

  it("treats a legacy pending record with unknown attempt history as immutable", async () => {
    accessState.saveUser(user(1));
    await queueStorage.upsert({
      id: "legacy-product-96", operationId: "legacy-operation-96",
      entity: "product", entityId: 96, action: "UPDATE", payload: { quantity: 1 },
      createdAt: 1, updatedAt: 1, retryCount: 0, status: "pending", nextAttemptAt: 0,
    });

    await queueService.enqueue("product", 96, "UPDATE", { quantity: 2 });

    const operations = await queueService.getForEntity("product", 96);
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({
      operationId: "legacy-operation-96",
      payload: { quantity: 1 },
    });
  });

  it("compacts a product edit only before its first attempt", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 95, "UPDATE", { name: "A", quantity: 1 });
    const original = (await queueService.getForEntity("product", 95))[0];
    await queueService.enqueue("product", 95, "UPDATE", { quantity: 2 });

    const operations = await queueService.getForEntity("product", 95);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      operationId: original.operationId,
      payload: { name: "A", quantity: 2 },
    });
  });

  it("never compacts additive movement operations", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("inventory_movement", 94, "CREATE", { product_id: 7, delta: 2 });
    await queueService.enqueue("inventory_movement", 94, "CREATE", { product_id: 7, delta: 3 });

    const operations = await queueService.getForEntity("inventory_movement", 94);
    expect(operations).toHaveLength(2);
    expect(operations.map((item) => item.payload)).toEqual([
      { product_id: 7, delta: 2 },
      { product_id: 7, delta: 3 },
    ]);
  });

  it("keeps a delete behind an in-flight create even after a newer edit", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 100, "CREATE", { quantity: 1 });
    const original = (await queueService.getDue())[0];
    await queueService.markInFlight(original);
    // A versionless local product is still represented as CREATE until the
    // predecessor acknowledgement supplies its first server version.
    await queueService.enqueue("product", 100, "CREATE", { quantity: 2 });

    await queueService.enqueue("product", 100, "DELETE", null);

    const operations = await queueService.getForEntity("product", 100);
    expect(operations).toHaveLength(2);
    expect(operations.find((item) => item.status === "in_flight")?.action).toBe("CREATE");
    expect(operations.find((item) => item.status === "pending")).toMatchObject({
      action: "DELETE",
      payload: null,
    });
  });

  it("rolls back the local record when the matching outbox write fails", async () => {
    accessState.saveUser(user(1));

    await expect(
      localMutationStorage.inventory(async () => {
        await inventoryStorage.save(product({ id: 303 }));
        throw new DOMException("full", "QuotaExceededError");
      }),
    ).rejects.toMatchObject({
      name: "LocalStorageWriteError",
      code: "quota_exceeded",
    });

    expect(await inventoryStorage.get(303)).toBeUndefined();
  });

  it("allows only one concurrent tab to claim the same outbox operation", async () => {
    accessState.saveUser(user(1));
    const queued = {
      id: "product-404",
      operationId: "operation-404",
      entity: "product",
      entityId: 404,
      action: "UPDATE" as const,
      payload: { quantity: 4 },
      createdAt: 1,
      updatedAt: 1,
      retryCount: 0,
      status: "pending" as const,
      nextAttemptAt: 0,
    };
    await queueStorage.upsert(queued);

    const claims = await Promise.all([
      queueStorage.claim(queued.id, queued.updatedAt, Date.now() + 60_000),
      queueStorage.claim(queued.id, queued.updatedAt, Date.now() + 60_000),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await queueStorage.get(queued.id))?.status).toBe("in_flight");
  });

  it("persists conflict payloads across a database restart", async () => {
    accessState.saveUser(user(1));
    const queued = {
      id: "product-505",
      operationId: "operation-505",
      entity: "product",
      entityId: 505,
      action: "UPDATE" as const,
      payload: { quantity: 17, version: 1 },
      createdAt: 1,
      updatedAt: 1,
      retryCount: 0,
      status: "in_flight" as const,
      nextAttemptAt: 0,
    };
    await queueStorage.upsert(queued);

    await queueService.markConflict(queued, "Server record has a newer version");
    db.close();
    await db.open();

    expect(await queueStorage.get(queued.id)).toMatchObject({
      status: "conflict",
      payload: { quantity: 17, version: 1 },
      lastError: "Server record has a newer version",
    });
  });

  it("turns an edit after conflict into a fresh retry operation", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 606, "UPDATE", { quantity: 4, version: 1 });
    const original = await queueStorage.get("product-606");
    expect(original).toBeDefined();
    await queueService.markConflict(original!, "newer server version");

    await queueService.enqueue("product", 606, "UPDATE", { quantity: 5, version: 2 });

    const operations = await queueService.getForEntity("product", 606);
    const fresh = operations.find((item) => item.status === "pending");
    expect(fresh).toMatchObject({
      status: "pending",
      payload: { quantity: 5, version: 2 },
      retryCount: 0,
    });
    expect(fresh?.operationId).not.toBe(original?.operationId);
    expect(operations.find((item) => item.status === "conflict")?.operationId)
      .toBe(original?.operationId);
  });

  it("never rebases a successor after its own attempt has started", async () => {
    accessState.saveUser(user(1));
    await queueService.enqueue("product", 607, "UPDATE", { quantity: 4, version: 1 });
    const predecessor = (await queueService.getDue())[0];
    const attemptedPredecessor = await queueService.markInFlight(predecessor);
    await queueService.markFailed(attemptedPredecessor!, new Error("response lost"));

    await queueService.enqueue("product", 607, "UPDATE", { quantity: 5, version: 1 });
    await queueStorage.upsert({ ...attemptedPredecessor!, nextAttemptAt: Number.MAX_SAFE_INTEGER });
    const successor = (await queueService.getForEntity("product", 607))[1];
    const attemptedSuccessor = await queueService.markInFlight(successor);

    await expect(
      queueService.prepareSuccessorAfterAcknowledgement(predecessor, 2),
    ).resolves.toBe(false);
    expect(await queueStorage.get(successor.id)).toMatchObject({
      operationId: attemptedSuccessor?.operationId,
      attemptState: "attempted",
      payload: { quantity: 5, version: 1 },
    });
  });
});
