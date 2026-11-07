import { describe, expect, it } from "vitest";

import { shouldAttemptAutomaticBackup } from "@/features/backup/services/backup-bootstrap";
import { notificationService } from "@/features/notifications/services/notification.service";
import type { BackupSettings, BackupStatus } from "@/features/backup/types";

const settings = (overrides: Partial<BackupSettings> = {}): BackupSettings => ({
  userId: 7,
  mode: "directory",
  onboardingCompleted: true,
  automaticEnabled: true,
  intervalMs: 300_000,
  permission: "granted",
  lastSuccessfulAt: 100,
  lastSuccessfulRevision: "old",
  lastFailure: null,
  retryCount: 0,
  nextAttemptAt: 100,
  restoreRequiresReview: false,
  ...overrides,
});

const status = (overrides: Partial<BackupStatus> = {}): BackupStatus => ({
  settings: settings(),
  currentRevision: "new",
  hasRecoverableData: true,
  dirty: true,
  busy: false,
  ...overrides,
});

describe("automatic backup policy", () => {
  it("runs an overdue changed backup and skips unchanged or not-yet-due data", () => {
    expect(shouldAttemptAutomaticBackup(status(), 101)).toBe(true);
    expect(shouldAttemptAutomaticBackup(status({ dirty: false }), 101)).toBe(false);
    expect(shouldAttemptAutomaticBackup(status({ settings: settings({ nextAttemptAt: 200 }) }), 101)).toBe(false);
  });

  it("never prompts in the background or writes automatic downloads", () => {
    expect(shouldAttemptAutomaticBackup(status({ settings: settings({ permission: "prompt" }) }), 101)).toBe(false);
    expect(shouldAttemptAutomaticBackup(status({ settings: settings({ mode: "manual", permission: "unsupported" }) }), 101)).toBe(false);
    expect(shouldAttemptAutomaticBackup(status({ settings: settings({ restoreRequiresReview: true }) }), 101)).toBe(false);
  });
});

describe("backup notifications", () => {
  it("keeps one stable notice per unresolved condition and resolves it with state", () => {
    const failed = status({ settings: settings({ lastFailure: "disk full", permission: "denied" }) });
    expect(notificationService.deriveBackup(failed).map((item) => item.id)).toEqual([
      "backup-failed",
      "backup-permission-required",
    ]);
    expect(notificationService.deriveBackup(failed).map((item) => item.id)).toEqual([
      "backup-failed",
      "backup-permission-required",
    ]);
    expect(notificationService.deriveBackup(status({ dirty: false, settings: settings() }))).toEqual([]);
  });

  it("recommends manual backup in unsupported browsers", () => {
    const items = notificationService.deriveBackup(status({
      settings: settings({ mode: "manual", permission: "unsupported" }),
    }));
    expect(items.map((item) => item.kind)).toEqual(["backup_manual_required"]);
  });
});
