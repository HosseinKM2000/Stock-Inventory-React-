import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  getAll: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/shared/access/access-state", () => ({ accessState: { user: mocks.user } }));
vi.mock("@/shared/lib/infrastructure/storage/queue-storage", () => ({
  queueStorage: {
    getAll: mocks.getAll,
    upsert: mocks.upsert,
    remove: vi.fn(),
  },
}));
vi.mock("@/shared/lib/infrastructure/sync/background-sync", () => ({
  requestBackgroundSync: vi.fn(),
}));

import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";

describe("immutable queue policy context", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.user.mockReturnValue({ id: 7, store_id: 3, store_operating_mode: "team", store_policy_version: 4 });
    mocks.getAll.mockResolvedValue([]);
  });

  it("captures the trusted team policy before dispatch", async () => {
    await queueService.enqueue("product", 9, "UPDATE", { quantity: 2 }, { operationId: "operation-1" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "operation-1",
      executionMode: "team",
      policyVersion: 4,
      attemptState: "never",
    }));
  });

  it("does not rewrite an existing operation when the observed policy changes", async () => {
    const pending = {
      id: "7:product-9", ownerUserId: 7, storeId: 3,
      operationId: "operation-1", entity: "product", entityId: 9,
      action: "UPDATE", payload: { quantity: 2 }, createdAt: 1, updatedAt: 1,
      retryCount: 0, status: "pending", nextAttemptAt: 1, attemptState: "never",
      executionMode: "team", policyVersion: 4,
    } satisfies SyncQueueItem;
    mocks.getAll.mockResolvedValue([pending]);
    mocks.user.mockReturnValue({ id: 7, store_id: 3, store_operating_mode: "team", store_policy_version: 5 });

    await queueService.enqueue("product", 9, "UPDATE", { quantity: 3 });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "operation-1", executionMode: "team", policyVersion: 4,
    }));
  });
});
