import { accessState } from "@/shared/access/access-state";
import {
  deliverManualBackup,
  externalBackupMode,
  isPickerCancellation,
  queryHandlePermission,
  requestHandlePermission,
  selectBackupDestination,
  writeConnectedBackup,
} from "./external-backup-adapter";
import { backupRepository } from "./backup-repository";
import { createBackupSnapshot, currentBackupRevision } from "./backup-snapshot";
import { parseBackupEnvelope, serializeBackupEnvelope } from "./backup-format";
import { backupStatusStore } from "./backup-status-store";
import { withBackupWriter } from "./backup-coordinator";

const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 5 * 60_000;
let activeWrite: Promise<"saved" | "unchanged" | "busy" | "permission_required"> | null = null;

function retryDelay(retryCount: number) {
  return Math.min(BASE_RETRY_MS * 2 ** Math.max(0, retryCount - 1), MAX_RETRY_MS);
}

async function recordFailure(userId: number, error: unknown) {
  const current = await backupRepository.get(userId);
  if (!current) return;
  const retryCount = current.retryCount + 1;
  await backupRepository.update(userId, {
    lastFailure: error instanceof Error ? error.message : String(error),
    retryCount,
    nextAttemptAt: Date.now() + retryDelay(retryCount),
  });
}

async function performSave(
  interactive: boolean,
  force: boolean,
  permissionRequest: Promise<import("../types").BackupPermission> | null,
) {
  const user = accessState.user();
  if (!user) throw new Error("BACKUP_ACCOUNT_REQUIRED");
  let settings = await backupRepository.getOrCreate(user.id, externalBackupMode());
  const current = await currentBackupRevision(user.id);
  if (!force && current.revision === settings.lastSuccessfulRevision) return "unchanged" as const;

  if (settings.mode !== "manual") {
    const permission = interactive
      ? await permissionRequest ?? await requestHandlePermission(settings.handle)
      : await queryHandlePermission(settings.handle);
    settings = await backupRepository.update(user.id, { permission });
    if (permission !== "granted") return "permission_required" as const;
  }

  const result = await withBackupWriter(user.id, async () => {
    backupStatusStore.setBusy(true);
    try {
      const snapshot = await createBackupSnapshot(user);
      const blob = serializeBackupEnvelope(snapshot);
      await parseBackupEnvelope(await blob.text(), user.id);
      if (settings.mode === "manual") await deliverManualBackup(blob);
      else await writeConnectedBackup(settings, blob);
      await backupRepository.update(user.id, {
        onboardingCompleted: true,
        lastSuccessfulAt: Date.now(),
        lastSuccessfulRevision: snapshot.snapshotRevision,
        lastFailure: null,
        retryCount: 0,
        nextAttemptAt: Date.now() + settings.intervalMs,
      });
      return "saved" as const;
    } catch (error) {
      await recordFailure(user.id, error);
      throw error;
    } finally {
      backupStatusStore.setBusy(false);
      await backupStatusStore.refresh();
    }
  });
  return result ?? "busy" as const;
}

export const backupService = {
  async setup() {
    const user = accessState.user();
    if (!user) throw new Error("BACKUP_ACCOUNT_REQUIRED");
    try {
      const destination = await selectBackupDestination();
      await backupRepository.getOrCreate(user.id, destination.mode);
      await backupRepository.update(user.id, {
        ...destination,
        permission: destination.mode === "manual" ? "unsupported" : "granted",
      });
      await backupStatusStore.refresh();
      return await this.saveNow({ interactive: true, force: true });
    } catch (error) {
      if (isPickerCancellation(error)) return "cancelled" as const;
      throw error;
    }
  },

  saveNow(options: { interactive: boolean; force?: boolean }) {
    if (activeWrite) return activeWrite;
    const connectedHandle = backupStatusStore.get().settings?.handle;
    const permissionRequest = options.interactive && connectedHandle
      ? requestHandlePermission(connectedHandle)
      : null;
    activeWrite = performSave(options.interactive, options.force ?? false, permissionRequest)
      .finally(() => { activeWrite = null; });
    return activeWrite;
  },

  async updateSettings(patch: { automaticEnabled?: boolean; intervalMs?: number }) {
    const user = accessState.user();
    if (!user) throw new Error("BACKUP_ACCOUNT_REQUIRED");
    await backupRepository.update(user.id, {
      ...patch,
      ...(patch.intervalMs !== undefined || patch.automaticEnabled === true
        ? { nextAttemptAt: Date.now() + (patch.intervalMs ?? (await backupRepository.getOrCreate(user.id, externalBackupMode())).intervalMs) }
        : {}),
    });
    return backupStatusStore.refresh();
  },

  async reconnect() {
    const user = accessState.user();
    if (!user) throw new Error("BACKUP_ACCOUNT_REQUIRED");
    try {
      const destination = await selectBackupDestination();
      await backupRepository.update(user.id, {
        ...destination,
        permission: destination.mode === "manual" ? "unsupported" : "granted",
      });
      await backupStatusStore.refresh();
      return true;
    } catch (error) {
      if (isPickerCancellation(error)) return false;
      throw error;
    }
  },
};
