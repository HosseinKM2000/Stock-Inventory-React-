import { beforeEach, describe, expect, it } from "vitest";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { queueStorage } from "@/shared/lib/infrastructure/storage/queue-storage";
import type { QueueStatus, SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import type { User } from "@/features/auth/types";

const OWNER_ID = 7;

function user(): User {
  return {
    id: OWNER_ID,
    first_name: "Queue",
    last_name: "Owner",
    username: "queue-owner",
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

function queued(id: string, status: QueueStatus): SyncQueueItem {
  return {
    id,
    ownerUserId: OWNER_ID,
    operationId: `operation-${id}`,
    entity: "product",
    entityId: 1,
    action: "CREATE",
    payload: { quantity: 1 },
    createdAt: 1,
    updatedAt: 1,
    retryCount: 3,
    status,
    nextAttemptAt: Date.now() + 60_000,
    lastError: "An industry is required before creating a product",
  };
}

async function statusOf(id: string) {
  const items = await queueStorage.getAll();
  return items.find((item) => item.id.endsWith(id))?.status;
}

describe("manual retry of failed queue items", () => {
  beforeEach(async () => {
    accessState.clear();
    await db.open();
    await db.syncQueue.clear();
    accessState.saveUser(user());
  });

  it("requeues an item the server rejected as fatal", async () => {
    await queueStorage.upsert(queued("fatal-1", "fatal_error"));

    await queueService.resetFailures();

    expect(await statusOf("fatal-1")).toBe("pending");
  });

  it("clears the retry count and backoff so the item sends immediately", async () => {
    await queueStorage.upsert(queued("fatal-2", "fatal_error"));

    await queueService.resetFailures();

    const items = await queueStorage.getAll();
    const item = items.find((entry) => entry.id.endsWith("fatal-2"));
    expect(item?.retryCount).toBe(0);
    expect(item?.nextAttemptAt).toBeLessThanOrEqual(Date.now());
  });

  it("still requeues retryable and dead-lettered items", async () => {
    await queueStorage.upsert(queued("retryable-1", "retryable_error"));
    await queueStorage.upsert(queued("dead-1", "dead_letter"));

    await queueService.resetFailures();

    expect(await statusOf("retryable-1")).toBe("pending");
    expect(await statusOf("dead-1")).toBe("pending");
  });

  it("leaves pending and in-flight work untouched", async () => {
    await queueStorage.upsert({ ...queued("pending-1", "pending"), retryCount: 0 });
    await queueStorage.upsert(queued("in-flight-1", "in_flight"));

    await queueService.resetFailures();

    expect(await statusOf("pending-1")).toBe("pending");
    expect(await statusOf("in-flight-1")).toBe("in_flight");
  });
});
