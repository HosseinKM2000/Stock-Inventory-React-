import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncService = {
  sync: vi.fn(async () => {}),
  refreshPending: vi.fn(async () => {}),
};
const entitlementService = {
  start: vi.fn(),
  verify: vi.fn(async () => {}),
  markOnline: vi.fn(),
  markOffline: vi.fn(),
};
const networkService = {
  isOffline: vi.fn(() => false),
  subscribe: vi.fn(),
};

vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({ syncService }));
vi.mock("@/shared/access/entitlement-service", () => ({ entitlementService }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService,
}));
vi.mock("@/shared/lib/infrastructure/sync/background-sync", () => ({
  BACKGROUND_SYNC_TAG: "inventory-sync",
  requestBackgroundSync: vi.fn(async () => {}),
}));

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

async function startListeners() {
  vi.resetModules();
  const module = await import(
    "@/shared/lib/infrastructure/sync/sync-listener"
  );
  module.startSyncListeners();
  // The startup synchronization is queued as a microtask chain.
  await vi.advanceTimersByTimeAsync(0);
}

describe("periodic synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("synchronizes once at startup", async () => {
    await startListeners();

    expect(syncService.sync).toHaveBeenCalledTimes(1);
  });

  it("does not synchronize again before twelve hours elapse", async () => {
    await startListeners();

    await vi.advanceTimersByTimeAsync(TWELVE_HOURS - 60 * 1000);

    expect(syncService.sync).toHaveBeenCalledTimes(1);
  });

  it("synchronizes again once twelve hours have elapsed", async () => {
    await startListeners();

    await vi.advanceTimersByTimeAsync(TWELVE_HOURS);

    expect(syncService.sync).toHaveBeenCalledTimes(2);
  });

  it("keeps synchronizing every twelve hours", async () => {
    await startListeners();

    await vi.advanceTimersByTimeAsync(TWELVE_HOURS * 3);

    expect(syncService.sync).toHaveBeenCalledTimes(4);
  });

  it("skips the periodic run while offline and resumes when back online", async () => {
    await startListeners();
    networkService.isOffline.mockReturnValue(true);

    await vi.advanceTimersByTimeAsync(TWELVE_HOURS);

    expect(syncService.sync).toHaveBeenCalledTimes(1);
    expect(entitlementService.markOffline).toHaveBeenCalled();

    networkService.isOffline.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.sync).toHaveBeenCalledTimes(2);
  });
});
