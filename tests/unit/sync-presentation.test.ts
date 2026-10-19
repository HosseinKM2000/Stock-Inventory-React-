import { describe, expect, it } from "vitest";
import { getSyncIndicator } from "@/features/app/layout/connection-status";
import type { SyncStatus } from "@/shared/lib/infrastructure/sync/sync-status";

const base: SyncStatus = {
  state: "idle",
  pending: 0,
  lastSyncedAt: null,
  error: null,
};

describe("sync status presentation", () => {
  it("uses the five visual phases for idle, pending, syncing, success, and error", () => {
    expect(getSyncIndicator(base, true).kind).toBe("idle");
    expect(getSyncIndicator({ ...base, pending: 2 }, true).kind).toBe("pending");
    expect(getSyncIndicator({ ...base, state: "syncing" }, true).kind).toBe("syncing");
    expect(getSyncIndicator({ ...base, state: "synced" }, true).kind).toBe("success");
    expect(getSyncIndicator({ ...base, state: "failed", error: "network" }, true).kind).toBe("error");
  });

  it("shows offline work as pending and includes the queued count", () => {
    const indicator = getSyncIndicator({ ...base, pending: 3 }, false);
    expect(indicator.kind).toBe("pending");
    expect(indicator.label).toContain("۳");
  });
});
