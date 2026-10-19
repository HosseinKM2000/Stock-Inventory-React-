import { accessState } from "@/shared/access/access-state";
import { currentBackupRevision } from "./backup-snapshot";
import { backupRepository } from "./backup-repository";
import { deriveBackupStatus } from "./backup-status";
import { externalBackupMode, queryHandlePermission } from "./external-backup-adapter";
import type { BackupStatus } from "../types";

type Listener = () => void;

class BackupStatusStore {
  private status: BackupStatus = deriveBackupStatus(null, null, false);
  private listeners = new Set<Listener>();

  get = () => this.status;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(status: BackupStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  setBusy(busy: boolean) {
    this.emit({ ...this.status, busy });
  }

  async refresh() {
    const user = accessState.user();
    if (!user) {
      this.emit(deriveBackupStatus(null, null, false));
      return this.status;
    }
    const settings = await backupRepository.getOrCreate(user.id, externalBackupMode());
    const permission = settings.mode === "manual"
      ? "unsupported" as const
      : await queryHandlePermission(settings.handle);
    const current = await currentBackupRevision(user.id);
    const nextSettings = permission === settings.permission
      ? settings
      : await backupRepository.update(user.id, { permission });
    if (accessState.user()?.id !== user.id) return this.status;
    const status = deriveBackupStatus(
      nextSettings,
      current.revision,
      current.hasRecoverableData,
      this.status.busy,
    );
    this.emit(status);
    return status;
  }
}

export const backupStatusStore = new BackupStatusStore();
