import { useSyncExternalStore } from "react";

import { backupStatusStore } from "../services/backup-status-store";

export function useBackupStatus() {
  return useSyncExternalStore(
    backupStatusStore.subscribe,
    backupStatusStore.get,
    backupStatusStore.get,
  );
}
