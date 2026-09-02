import { beforeEach, describe, expect, it } from "vitest";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueStorage } from "@/shared/lib/infrastructure/storage/queue-storage";
import type { User } from "@/features/auth/types";
import { product } from "../helpers/product";

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
      db.syncQueue.clear(),
      db.syncMetadata.clear(),
    ]);
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
    accessState.saveUser(user(2));
    await queueStorage.upsert(record("product-1"));
    expect(await queueStorage.count()).toBe(1);
    await queueStorage.clear();

    accessState.saveUser(user(1));
    expect(await queueStorage.count()).toBe(1);
  });
});
