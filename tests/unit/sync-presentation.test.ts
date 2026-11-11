import { describe, expect, it } from "vitest";
import { getCompactSyncLabel, getSyncHeaderAction, getSyncIndicator, syncDiagnosticCode, syncErrorMessage } from "@/features/app/layout/connection-status";
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
    expect(indicator.tooltip).toContain("هنوز سرور آن را نپذیرفته");
  });

  it("keeps error classes distinct without presenting raw codes as the message", () => {
    expect(syncErrorMessage("PERMISSION_DENIED")).toContain("دسترسی فعلی");
    expect(syncErrorMessage("OPERATION_PAYLOAD_MISMATCH")).toContain("قطعی نیست");
    expect(syncErrorMessage("SOME_NEW_INTERNAL_CODE")).not.toContain("SOME_NEW_INTERNAL_CODE");
    expect(syncDiagnosticCode("SOME_NEW_INTERNAL_CODE")).toBe("SOME_NEW_INTERNAL_CODE");
    expect(syncDiagnosticCode("Failed to fetch secret details")).toBeNull();
    expect(syncErrorMessage("SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED:STORE_MEMBERSHIP_INACTIVE"))
      .toContain("ثابت نمی‌کند");
  });

  it("maps backlog states to short labels and safe contextual actions", () => {
    expect(getCompactSyncLabel({ ...base, pending: 3 }, true)).toBe("۳ صف");
    expect(getSyncHeaderAction({ ...base, pending: 3 }, true)).toEqual({ kind: "sync", label: "ارسال" });
    expect(getSyncHeaderAction({ ...base, pending: 3 }, false)).toBeNull();
    expect(getSyncHeaderAction({ ...base, state: "failed", pending: 1, error: "Failed to fetch" }, true))
      .toEqual({ kind: "retry", label: "تلاش" });
    expect(getSyncHeaderAction({ ...base, state: "conflict" }, true))
      .toEqual({ kind: "details", label: "بررسی", to: "/setting/sync" });
    expect(getSyncHeaderAction({ ...base, error: "SYNC_PAUSED_FOR_RESTORE" }, true))
      .toEqual({ kind: "recovery", label: "بازیابی", to: "/setting/backup" });
  });
});
