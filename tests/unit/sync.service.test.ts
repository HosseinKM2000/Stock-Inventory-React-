import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

const mocks = vi.hoisted(() => ({
  isOffline: vi.fn(), isOnline: vi.fn(), isAuthenticated: vi.fn(),
  count: vi.fn(), getDue: vi.fn(), getAll: vi.fn(), markInFlight: vi.fn(),
  markFailed: vi.fn(), removeIfUnchanged: vi.fn(), resetFailures: vi.fn(),
  canAccess: vi.fn(), canWrite: vi.fn(), ensureVerified: vi.fn(), setStatus: vi.fn(), getStatus: vi.fn(),
}));
vi.mock("@/shared/api/token-store", () => ({ isAuthenticated: mocks.isAuthenticated }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: mocks.isOffline, isOnline: mocks.isOnline },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({
  queueService: {
    count: mocks.count, getDue: mocks.getDue, getAll: mocks.getAll,
    markInFlight: mocks.markInFlight, markFailed: mocks.markFailed,
    removeIfUnchanged: mocks.removeIfUnchanged, resetFailures: mocks.resetFailures,
  },
}));
vi.mock("@/shared/access/access-state", () => ({
  accessState: { canAccess: mocks.canAccess, canWrite: mocks.canWrite },
}));
vi.mock("@/shared/access/entitlement-service", () => ({
  entitlementService: { ensureVerified: mocks.ensureVerified },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-status", () => ({
  syncStatusStore: { set: mocks.setStatus, get: mocks.getStatus },
}));

import { registerSyncHandler, syncService } from "@/shared/lib/infrastructure/sync/sync-service";

function item(entity: string): SyncQueueItem {
  return {
    id: `1:${entity}-1`, ownerUserId: 1, operationId: "operation-1",
    entity, entityId: 1, action: "UPDATE", payload: { quantity: 2 },
    createdAt: 1, updatedAt: 1, retryCount: 0, status: "pending", nextAttemptAt: 0,
  };
}

describe("synchronization orchestration", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.isOffline.mockReturnValue(false);
    mocks.isOnline.mockReturnValue(true);
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.canAccess.mockReturnValue(true);
    mocks.canWrite.mockReturnValue(true);
    mocks.ensureVerified.mockResolvedValue(undefined);
    mocks.markInFlight.mockResolvedValue(true);
    mocks.removeIfUnchanged.mockResolvedValue(true);
    mocks.getAll.mockResolvedValue([]);
    mocks.getStatus.mockReturnValue({ lastSyncedAt: null });
  });

  it("leaves queued work untouched while offline", async () => {
    mocks.isOffline.mockReturnValue(true);
    mocks.count.mockResolvedValue(2);
    await syncService.sync();
    expect(mocks.getDue).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenCalledWith({ state: "idle", pending: 2 });
  });

  it("marks applied operations in flight and removes only the unchanged record", async () => {
    const entity = "applied-test";
    const queued = item(entity);
    mocks.getDue.mockResolvedValue([queued]);
    registerSyncHandler(entity, vi.fn().mockResolvedValue([{ itemId: queued.id, status: "applied" }]));
    await syncService.sync();
    expect(mocks.markInFlight).toHaveBeenCalledWith(queued);
    expect(mocks.removeIfUnchanged).toHaveBeenCalledWith(queued);
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "synced", pending: 0 }));
  });

  it("retains an operation for retry when the server omits its result", async () => {
    const entity = "omitted-test";
    const queued = item(entity);
    mocks.getDue.mockResolvedValue([queued]);
    registerSyncHandler(entity, vi.fn().mockResolvedValue([]));
    await syncService.sync();
    expect(mocks.markFailed).toHaveBeenCalledWith(queued, expect.any(Error));
    expect(mocks.removeIfUnchanged).not.toHaveBeenCalled();
  });

  it("does not push queued writes after subscription expiry", async () => {
    mocks.canWrite.mockReturnValue(false);
    mocks.getAll.mockResolvedValue([item("preserved-test")]);
    await syncService.sync();
    expect(mocks.getDue).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "failed", pending: 1, error: "SUBSCRIPTION_EXPIRED",
    }));
  });
});
