import type { BackupSettings, BackupStatus } from "../types";

export function deriveBackupStatus(
  settings: BackupSettings | null,
  currentRevision: string | null,
  hasRecoverableData: boolean,
  busy = false,
): BackupStatus {
  return {
    settings,
    currentRevision,
    hasRecoverableData,
    dirty: hasRecoverableData && currentRevision !== settings?.lastSuccessfulRevision,
    busy,
  };
}
