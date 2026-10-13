import { liveQuery, type Subscription } from "dexie";

import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { backupService } from "./backup-service";
import { backupStatusStore } from "./backup-status-store";
import type { BackupStatus } from "../types";

export const BACKUP_RELEVANT_CHANGE_EVENT = "tanzim-backup-relevant-change";
const CHECK_INTERVAL_MS = 30_000;
let started = false;
let dataSubscription: Subscription | null = null;

export function shouldAttemptAutomaticBackup(status: BackupStatus, now = Date.now()) {
  const settings = status.settings;
  return Boolean(
    settings && settings.mode !== "manual" && settings.onboardingCompleted &&
    settings.automaticEnabled && status.dirty && !status.busy &&
    settings.permission === "granted" && !settings.restoreRequiresReview &&
    settings.nextAttemptAt <= now,
  );
}

async function refreshAndMaybeSave() {
  const status = await backupStatusStore.refresh();
  if (!shouldAttemptAutomaticBackup(status)) return;
  await backupService.saveNow({ interactive: false }).catch(() => undefined);
}

function watchCurrentAccount() {
  dataSubscription?.unsubscribe();
  const userId = accessState.user()?.id;
  if (!userId) {
    void backupStatusStore.refresh();
    return;
  }
  dataSubscription = liveQuery(async () => {
    await Promise.all([
      db.inventoryItems.where("local_user_id").equals(userId).toArray(),
      db.categories.where("local_user_id").equals(userId).toArray(),
      db.labels.where("local_user_id").equals(userId).toArray(),
      db.syncQueue.where("ownerUserId").equals(userId).toArray(),
      db.backupSettings.get(userId),
    ]);
    return userId;
  }).subscribe({
    next: () => { void backupStatusStore.refresh(); },
    error: () => undefined,
  });
}

export function startBackupAutomation() {
  if (started) return;
  started = true;
  watchCurrentAccount();
  accessState.subscribe(watchCurrentAccount);
  window.addEventListener(BACKUP_RELEVANT_CHANGE_EVENT, () => { void backupStatusStore.refresh(); });
  window.addEventListener("focus", () => { void refreshAndMaybeSave(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshAndMaybeSave();
  });
  window.setInterval(() => { void refreshAndMaybeSave(); }, CHECK_INTERVAL_MS);
  void refreshAndMaybeSave();
}
