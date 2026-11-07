import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { ApiError } from "@/shared/api/api-error";

const mocks = vi.hoisted(() => ({
  isOffline: vi.fn(), isOnline: vi.fn(), isAuthenticated: vi.fn(),
  count: vi.fn(), getDue: vi.fn(), getAll: vi.fn(), markInFlight: vi.fn(),
  markFailed: vi.fn(), markConflict: vi.fn(), removeIfUnchanged: vi.fn(), resetFailures: vi.fn(),
  releaseAfterAuthFailure: vi.fn(), markAccessDeniedUnresolved: vi.fn(),
  canAccess: vi.fn(), ensureVerified: vi.fn(), setStatus: vi.fn(), getStatus: vi.fn(),
  user: vi.fn(),
  processMediaDue: vi.fn(),
  fetchRecordedOperationResult: vi.fn(),
}));
vi.mock("@/shared/api/token-store", () => ({ isAuthenticated: mocks.isAuthenticated }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: mocks.isOffline, isOnline: mocks.isOnline },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({
  isAccessDeniedOutcomeUnresolved: (item: { lastError?: string }) =>
    item.lastError?.startsWith("SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED:") ?? false,
  queueService: {
    count: mocks.count, getDue: mocks.getDue, getAll: mocks.getAll,
    markInFlight: mocks.markInFlight, markFailed: mocks.markFailed,
    markConflict: mocks.markConflict,
    releaseAfterAuthFailure: mocks.releaseAfterAuthFailure,
    markAccessDeniedUnresolved: mocks.markAccessDeniedUnresolved,
    removeIfUnchanged: mocks.removeIfUnchanged, resetFailures: mocks.resetFailures,
  },
}));
vi.mock("@/shared/access/access-state", () => ({
  accessState: { canAccess: mocks.canAccess, user: mocks.user },
}));
vi.mock("@/shared/access/entitlement-service", () => ({
  entitlementService: { ensureVerified: mocks.ensureVerified },
}));
vi.mock("@/shared/lib/infrastructure/media/media-transfer.service", () => ({
  mediaOperationBlocked: () => false,
  mediaTransferService: { processDue: mocks.processMediaDue },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-status", () => ({
  syncStatusStore: { set: mocks.setStatus, get: mocks.getStatus },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-operation-resolution", () => ({
  fetchRecordedOperationResult: mocks.fetchRecordedOperationResult,
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
    mocks.user.mockReturnValue({ id: 1, store_id: 1 });
    mocks.ensureVerified.mockResolvedValue(undefined);
    mocks.processMediaDue.mockResolvedValue([]);
    mocks.markInFlight.mockImplementation(async (queued) => queued);
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

  it("does not dispatch when the durable in-flight claim fails", async () => {
    const entity = "claim-failure-test";
    const queued = item(entity);
    const handler = vi.fn();
    mocks.getDue.mockResolvedValue([queued]);
    mocks.markInFlight.mockRejectedValue(new Error("indexeddb unavailable"));
    registerSyncHandler(entity, handler);

    await syncService.sync();

    expect(handler).not.toHaveBeenCalled();
    expect(mocks.removeIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "failed",
      error: "indexeddb unavailable",
    }));
  });

  it("drains a newly unblocked successor in the same synchronization run", async () => {
    const entity = "successor-test";
    const first = item(entity);
    const successor = {
      ...first,
      id: `1:${entity}-2`,
      operationId: "operation-2",
      createdAt: 2,
      updatedAt: 2,
    };
    const handler = vi.fn(async (items: SyncQueueItem[]) => (
      items.map((queued) => ({ itemId: queued.id, status: "applied" as const }))
    ));
    mocks.getDue
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([successor])
      .mockResolvedValueOnce([]);
    registerSyncHandler(entity, handler);

    await syncService.sync();

    expect(handler).toHaveBeenNthCalledWith(1, [first]);
    expect(handler).toHaveBeenNthCalledWith(2, [successor]);
    expect(mocks.removeIfUnchanged).toHaveBeenCalledTimes(2);
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

  it("does not acknowledge an old partition after the authenticated account changes", async () => {
    const entity = "account-change-test";
    const queued = item(entity);
    mocks.getDue.mockResolvedValue([queued]);
    registerSyncHandler(entity, vi.fn().mockImplementation(async () => {
      mocks.user.mockReturnValue({ id: 2, store_id: 2 });
      return [{ itemId: queued.id, status: "applied" }];
    }));

    await syncService.sync();

    expect(mocks.removeIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.markFailed).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "failed",
      error: "SYNC_ACCOUNT_CHANGED",
    }));
  });

  it("retains a rejected local change as an inspectable conflict", async () => {
    const entity = "conflict-test";
    const queued = item(entity);
    mocks.getDue.mockResolvedValue([queued]);
    mocks.getAll.mockResolvedValue([{ ...queued, status: "conflict", lastError: "newer server version" }]);
    registerSyncHandler(entity, vi.fn().mockResolvedValue([{
      itemId: queued.id,
      status: "conflict",
      error: "newer server version",
    }]));

    await syncService.sync();

    expect(mocks.markConflict).toHaveBeenCalledWith(queued, "newer server version");
    expect(mocks.removeIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "conflict",
      pending: 1,
      error: "newer server version",
    }));
  });

  it("stops automatic retry when current membership or entitlement denies the batch", async () => {
    const entity = "revoked-membership-test";
    const queued = { ...item(entity), attemptState: "attempted" as const };
    mocks.getDue.mockResolvedValueOnce([queued]).mockResolvedValueOnce([]);
    registerSyncHandler(entity, vi.fn().mockRejectedValue(
      new ApiError(403, "STORE_MEMBERSHIP_INACTIVE"),
    ));

    await syncService.sync();

    expect(mocks.releaseAfterAuthFailure).not.toHaveBeenCalled();
    expect(mocks.markAccessDeniedUnresolved).toHaveBeenCalledWith(
      queued,
      expect.objectContaining({ message: "STORE_MEMBERSHIP_INACTIVE" }),
    );
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });

  it("records a first-attempt 403 as a definite server rejection", async () => {
    const entity = "first-attempt-denial-test";
    const queued = { ...item(entity), attemptState: "never" as const };
    mocks.getDue.mockResolvedValueOnce([queued]).mockResolvedValueOnce([]);
    registerSyncHandler(entity, vi.fn().mockRejectedValue(
      new ApiError(403, "ENTITLEMENT_EXPIRED"),
    ));

    await syncService.sync();

    expect(mocks.markAccessDeniedUnresolved).not.toHaveBeenCalled();
    expect(mocks.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: queued.operationId }),
      expect.objectContaining({ message: "ENTITLEMENT_EXPIRED" }),
      true,
    );
  });

  it("keeps a command pending when authentication must be renewed", async () => {
    const entity = "authentication-renewal-test";
    const queued = item(entity);
    mocks.getDue.mockResolvedValueOnce([queued]).mockResolvedValueOnce([]);
    registerSyncHandler(entity, vi.fn().mockRejectedValue(
      new ApiError(401, "AUTHENTICATION_REQUIRED"),
    ));

    await syncService.sync();

    expect(mocks.releaseAfterAuthFailure).toHaveBeenCalledWith(
      queued,
      expect.objectContaining({ message: "AUTHENTICATION_REQUIRED" }),
    );
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });

  it("submits durable work after subscription expiry so the server can preserve a terminal rejection", async () => {
    const entity = "expired-test";
    const queued = item(entity);
    const handler = vi.fn().mockResolvedValue([{
      itemId: queued.id,
      status: "fatal_error",
      error: "ENTITLEMENT_EXPIRED",
    }]);
    registerSyncHandler(entity, handler);
    mocks.getDue.mockResolvedValueOnce([queued]).mockResolvedValueOnce([]);
    mocks.getAll.mockResolvedValue([{
      ...queued,
      status: "fatal_error",
      lastError: "ENTITLEMENT_EXPIRED",
    }]);

    await syncService.sync();

    expect(handler).toHaveBeenCalledWith([queued]);
    expect(mocks.markFailed).toHaveBeenCalledWith(queued, expect.any(Error), true);
    expect(mocks.removeIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      state: "failed", pending: 1, error: "ENTITLEMENT_EXPIRED",
    }));
  });

  it("resolves an access-denied uncertain outcome read-only under the same operation identity", async () => {
    const queued = {
      ...item("resolution-test"),
      attemptState: "uncertain" as const,
      status: "fatal_error" as const,
      lastError: "SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED:STORE_MEMBERSHIP_INACTIVE",
    };
    mocks.fetchRecordedOperationResult.mockResolvedValue({
      operation_id: queued.operationId,
      status: "applied",
      entity_id: queued.entityId,
      record: { id: queued.entityId },
      error: null,
    });
    mocks.getDue.mockResolvedValue([]);
    mocks.getAll.mockResolvedValue([]);

    await syncService.resolveAccessDeniedOutcome(queued);

    expect(mocks.fetchRecordedOperationResult).toHaveBeenCalledWith(queued.operationId);
    expect(mocks.removeIfUnchanged).toHaveBeenCalledWith(queued);
    expect(mocks.markFailed).not.toHaveBeenCalled();
  });
});
