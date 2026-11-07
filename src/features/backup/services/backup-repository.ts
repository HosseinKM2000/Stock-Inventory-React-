import { db } from "@/shared/lib/infrastructure/storage/db";
import {
  DEFAULT_BACKUP_INTERVAL_MS,
  type BackupMode,
  type BackupSettings,
} from "../types";

export function defaultBackupSettings(userId: number, mode: BackupMode): BackupSettings {
  return {
    userId,
    mode,
    onboardingCompleted: false,
    automaticEnabled: mode !== "manual",
    intervalMs: DEFAULT_BACKUP_INTERVAL_MS,
    permission: mode === "manual" ? "unsupported" : "missing",
    lastSuccessfulAt: null,
    lastSuccessfulRevision: null,
    lastFailure: null,
    retryCount: 0,
    nextAttemptAt: 0,
    restoreRequiresReview: false,
  };
}

export const backupRepository = {
  get(userId: number) {
    return db.backupSettings.get(userId);
  },

  async getOrCreate(userId: number, mode: BackupMode) {
    const existing = await this.get(userId);
    if (existing) return existing;
    const created = defaultBackupSettings(userId, mode);
    await db.backupSettings.put(created);
    return created;
  },

  async update(userId: number, patch: Partial<BackupSettings>) {
    const current = await this.get(userId);
    if (!current) throw new Error("BACKUP_SETTINGS_NOT_FOUND");
    const updated = { ...current, ...patch, userId };
    await db.backupSettings.put(updated);
    return updated;
  },
};
