import { beforeEach, describe, expect, it, vi } from "vitest";

import { backupService } from "@/features/backup/services/backup-service";
import type { BackupEnvelope, BackupSettings } from "@/features/backup/types";
import type { User } from "@/features/auth/types";

const mocks = vi.hoisted(() => ({
  user: { id: 12, username: "owner" } as User,
  settings: null as BackupSettings | null,
  select: vi.fn(),
  write: vi.fn(),
  deliver: vi.fn(),
  queryPermission: vi.fn(async () => "granted" as const),
  requestPermission: vi.fn(async () => "granted" as const),
  getOrCreate: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  currentRevision: vi.fn(),
  createSnapshot: vi.fn(),
  refresh: vi.fn(),
  setBusy: vi.fn(),
}));

vi.mock("@/shared/access/access-state", () => ({ accessState: { user: () => mocks.user } }));
vi.mock("@/features/backup/services/external-backup-adapter", () => ({
  externalBackupMode: () => "directory",
  selectBackupDestination: mocks.select,
  writeConnectedBackup: mocks.write,
  deliverManualBackup: mocks.deliver,
  queryHandlePermission: mocks.queryPermission,
  requestHandlePermission: mocks.requestPermission,
  isPickerCancellation: (error: unknown) => error instanceof DOMException && error.name === "AbortError",
}));
vi.mock("@/features/backup/services/backup-repository", () => ({
  backupRepository: { getOrCreate: mocks.getOrCreate, get: mocks.get, update: mocks.update },
}));
vi.mock("@/features/backup/services/backup-snapshot", () => ({
  currentBackupRevision: mocks.currentRevision,
  createBackupSnapshot: mocks.createSnapshot,
}));
vi.mock("@/features/backup/services/backup-format", () => ({
  serializeBackupEnvelope: () => new Blob(["valid"]),
  parseBackupEnvelope: vi.fn(async () => ({})),
}));
vi.mock("@/features/backup/services/backup-status-store", () => ({
  backupStatusStore: { get: () => ({ settings: mocks.settings }), refresh: mocks.refresh, setBusy: mocks.setBusy },
}));
vi.mock("@/features/backup/services/backup-coordinator", () => ({
  withBackupWriter: async (_userId: number, operation: () => Promise<unknown>) => operation(),
}));

const baseSettings = (): BackupSettings => ({
  userId: 12,
  mode: "directory",
  onboardingCompleted: true,
  automaticEnabled: true,
  intervalMs: 300_000,
  destinationName: "Backups/tanzim-backup.tanzimbackup",
  handle: { kind: "directory", name: "Backups" } as FileSystemDirectoryHandle,
  permission: "granted",
  lastSuccessfulAt: 1,
  lastSuccessfulRevision: "saved",
  lastFailure: null,
  retryCount: 0,
  nextAttemptAt: 0,
  restoreRequiresReview: false,
});

describe("backup service write lifecycle", () => {
  beforeEach(() => {
    mocks.settings = baseSettings();
    mocks.getOrCreate.mockReset().mockImplementation(async () => mocks.settings);
    mocks.get.mockReset().mockImplementation(async () => mocks.settings);
    mocks.update.mockReset().mockImplementation(async (_id, patch) => {
      mocks.settings = { ...mocks.settings!, ...patch };
      return mocks.settings;
    });
    mocks.currentRevision.mockReset().mockResolvedValue({ revision: "changed", hasRecoverableData: true });
    mocks.createSnapshot.mockReset().mockResolvedValue({ snapshotRevision: "changed" } as BackupEnvelope);
    mocks.select.mockReset().mockResolvedValue({ mode: "directory", handle: mocks.settings.handle, destinationName: mocks.settings.destinationName });
    mocks.write.mockReset().mockResolvedValue(undefined);
    mocks.deliver.mockReset().mockResolvedValue(undefined);
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.setBusy.mockClear();
  });

  it("skips a periodic write when the current revision is already saved", async () => {
    mocks.currentRevision.mockResolvedValue({ revision: "saved", hasRecoverableData: true });
    await expect(backupService.saveNow({ interactive: false })).resolves.toBe("unchanged");
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("coalesces duplicate clicks into one write and records success only after close", async () => {
    let finish!: () => void;
    mocks.write.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = backupService.saveNow({ interactive: true });
    const second = backupService.saveNow({ interactive: true });
    expect(second).toBe(first);
    await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledOnce());
    expect(mocks.update).not.toHaveBeenCalledWith(12, expect.objectContaining({ lastSuccessfulRevision: "changed" }));
    finish();
    await expect(first).resolves.toBe("saved");
    expect(mocks.write).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith(12, expect.objectContaining({ lastSuccessfulRevision: "changed" }));
  });

  it("opens the destination from explicit setup and quietly preserves onboarding on cancellation", async () => {
    mocks.settings = { ...baseSettings(), onboardingCompleted: false };
    await expect(backupService.setup()).resolves.toBe("saved");
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.write).toHaveBeenCalledOnce();

    mocks.select.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    await expect(backupService.setup()).resolves.toBe("cancelled");
  });
});
