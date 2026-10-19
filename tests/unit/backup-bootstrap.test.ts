import { beforeEach, describe, expect, it, vi } from "vitest";

import { startBackupAutomation } from "@/features/backup/services/backup-bootstrap";
import type { BackupStatus } from "@/features/backup/types";

const mocks = vi.hoisted(() => ({
  saveNow: vi.fn(async () => "saved"),
  refresh: vi.fn<() => Promise<BackupStatus>>(),
}));

vi.mock("@/shared/access/access-state", () => ({
  accessState: { user: () => null, subscribe: vi.fn() },
}));
vi.mock("@/features/backup/services/backup-status-store", () => ({
  backupStatusStore: { refresh: mocks.refresh },
}));
vi.mock("@/features/backup/services/backup-service", () => ({
  backupService: { saveNow: mocks.saveNow },
}));

function eligible(permission: PermissionState = "granted"): BackupStatus {
  return {
    currentRevision: "new",
    hasRecoverableData: true,
    dirty: true,
    busy: false,
    settings: {
      userId: 1,
      mode: "directory",
      onboardingCompleted: true,
      automaticEnabled: true,
      intervalMs: 300_000,
      permission,
      lastSuccessfulAt: 1,
      lastSuccessfulRevision: "old",
      lastFailure: null,
      retryCount: 0,
      nextAttemptAt: 0,
      restoreRequiresReview: false,
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("backup startup and foreground checks", () => {
  beforeEach(() => {
    mocks.saveNow.mockClear();
    mocks.refresh.mockReset().mockResolvedValue(eligible());
  });

  it("checks on startup and focus, but never prompts when permission was lost", async () => {
    startBackupAutomation();
    await settle();
    expect(mocks.saveNow).toHaveBeenCalledTimes(1);
    expect(mocks.saveNow).toHaveBeenLastCalledWith({ interactive: false });

    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(mocks.saveNow).toHaveBeenCalledTimes(2);

    mocks.refresh.mockResolvedValue(eligible("prompt"));
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(mocks.saveNow).toHaveBeenCalledTimes(2);
  });
});
