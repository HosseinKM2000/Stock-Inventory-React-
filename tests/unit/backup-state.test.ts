import { describe, expect, it } from "vitest";

import { deriveBackupStatus } from "@/features/backup/services/backup-status";
import type { BackupSettings } from "@/features/backup/types";

const settings = (overrides: Partial<BackupSettings> = {}): BackupSettings => ({
  userId: 7,
  mode: "manual",
  onboardingCompleted: true,
  automaticEnabled: false,
  intervalMs: 300_000,
  permission: "unsupported",
  lastSuccessfulAt: null,
  lastSuccessfulRevision: null,
  lastFailure: null,
  retryCount: 0,
  nextAttemptAt: 0,
  restoreRequiresReview: false,
  ...overrides,
});

describe("backup revision status", () => {
  it("is dirty before first backup when recoverable data exists", () => {
    expect(deriveBackupStatus(settings(), "rev-1", true).dirty).toBe(true);
  });

  it("clears only for the exact successfully written revision", () => {
    expect(deriveBackupStatus(settings({ lastSuccessfulRevision: "rev-1" }), "rev-1", true).dirty).toBe(false);
    expect(deriveBackupStatus(settings({ lastSuccessfulRevision: "rev-1" }), "rev-2", true).dirty).toBe(true);
  });

  it("does not show a dot for an empty account", () => {
    expect(deriveBackupStatus(settings(), "empty", false).dirty).toBe(false);
  });
});
