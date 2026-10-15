import type { User } from "@/features/auth/types";
import { accessState } from "@/shared/access/access-state";
import { queryClient } from "@/shared/api/query-client";
import { imageRepository } from "@/shared/lib/infrastructure/media/image.repository";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { syncStatusStore } from "@/shared/lib/infrastructure/sync/sync-status";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import type { BackupEnvelope, BackupPreview } from "../types";
import { parseBackupEnvelope, serializeBackupEnvelope } from "./backup-format";
import { createBackupSnapshot } from "./backup-snapshot";
import { deliverManualBackup, readConnectedBackup } from "./external-backup-adapter";
import { backupRepository } from "./backup-repository";
import { backupStatusStore } from "./backup-status-store";
import { withBackupRestore } from "./backup-coordinator";

function fromBase64(value: string, mimeType: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export async function previewBackupFile(file: File, userId: number, storeId = userId): Promise<BackupPreview> {
  const envelope = await parseBackupEnvelope(await file.text(), userId, storeId);
  return { envelope, sourceName: file.name };
}

async function writeRecoveryCopy(user: User) {
  const snapshot = await createBackupSnapshot(user);
  const blob = serializeBackupEnvelope(snapshot);
  await deliverManualBackup(blob);
}

function restoredQueue(items: SyncQueueItem[], userId: number): SyncQueueItem[] {
  const now = Date.now();
  return items.map((item) => ({
    ...item,
    id: `${userId}:restored:${crypto.randomUUID()}`,
    ownerUserId: userId,
    operationId: crypto.randomUUID(),
    status: "conflict",
    nextAttemptAt: Number.MAX_SAFE_INTEGER,
    updatedAt: now,
    lastError: "RESTORED_BACKUP_REVIEW_REQUIRED",
  }));
}

function restoreScope(user: User) {
  const storeId = user.store_id ?? user.id;
  return { storeId, key: (id: number) => `${user.id}:${storeId}:${id}` };
}

function restorePreferences(envelope: BackupEnvelope, userId: number) {
  const allowed = new Set([
    "inventory-appearance",
    `inventory:${userId}:hide-catalog-products`,
    `inventory:${userId}:profile-media-v1`,
  ]);
  for (const [key, value] of Object.entries(envelope.data.preferences)) {
    if (allowed.has(key)) localStorage.setItem(key, value);
  }
  const appearance = envelope.data.preferences["inventory-appearance"];
  if (appearance === "light" || appearance === "dark" || appearance === "system") {
    window.dispatchEvent(new CustomEvent("appearance-change", { detail: appearance }));
  }
  window.dispatchEvent(new Event("profile-media-change"));
}

export const backupRestoreService = {
  async previewConnected(user: User) {
    const settings = await backupRepository.get(user.id);
    if (!settings) throw new Error("BACKUP_SETTINGS_NOT_FOUND");
    return previewBackupFile(await readConnectedBackup(settings), user.id, user.store_id ?? user.id);
  },

  async apply(preview: BackupPreview, user: User) {
    if (user.is_store_owner === false) throw new Error("BACKUP_STORE_OWNER_REQUIRED");
    if (preview.envelope.owner.userId !== user.id) throw new Error("BACKUP_OWNER_MISMATCH");
    const restored = await withBackupRestore(user.id, async () => {
      syncService.pause("backup-restore-review", user.id);
      try {
        await writeRecoveryCopy(user);
        for (const image of preview.envelope.data.images) {
          await imageRepository.restore(image.path, fromBase64(image.base64, image.mimeType));
        }

        const data = preview.envelope.data;
        const scope = restoreScope(user);
        await db.transaction(
          "rw",
          [db.inventoryItems, db.categories, db.labels, db.syncQueue, db.syncMetadata],
          async () => {
            const [productIds, categoryIds, labelIds, queueIds] = await Promise.all([
              db.inventoryItems.where("[local_user_id+local_store_id]").equals([user.id, scope.storeId]).primaryKeys(),
              db.categories.where("[local_user_id+local_store_id]").equals([user.id, scope.storeId]).primaryKeys(),
              db.labels.where("[local_user_id+local_store_id]").equals([user.id, scope.storeId]).primaryKeys(),
              db.syncQueue.where("ownerUserId").equals(user.id).primaryKeys(),
            ]);
            await Promise.all([
              db.inventoryItems.bulkDelete(productIds),
              db.categories.bulkDelete(categoryIds),
              db.labels.bulkDelete(labelIds),
              db.syncQueue.bulkDelete(queueIds),
            ]);
            await db.inventoryItems.bulkPut(data.products.map((item) => ({ ...item, local_user_id: user.id, local_store_id: scope.storeId, local_key: scope.key(item.id) })));
            await db.categories.bulkPut(data.categories.map((item) => ({ ...item, local_user_id: user.id, local_store_id: scope.storeId, local_key: scope.key(item.id) })));
            await db.labels.bulkPut(data.labels.map((item) => ({ ...item, local_user_id: user.id, local_store_id: scope.storeId, local_key: scope.key(item.id) })));
            await db.syncQueue.bulkPut(restoredQueue(data.pendingOperations, user.id).map((item) => ({ ...item, storeId: scope.storeId })));
            await db.syncMetadata.put({
              key: `${user.id}:${scope.storeId}:restore-reconciliation-required`,
              value: preview.envelope.createdAt,
              updatedAt: Date.now(),
            });
          },
        );
        restorePreferences(preview.envelope, user.id);
        await backupRepository.update(user.id, { restoreRequiresReview: true });
        await queryClient.invalidateQueries();
        await backupStatusStore.refresh();
        return true;
      } catch (error) {
        syncService.resume(user.id);
        throw error;
      }
    });
    if (!restored) throw new Error("BACKUP_RESTORE_BUSY");
  },

  async resumeSynchronization(userId: number) {
    if (networkService.isOffline()) throw new Error("BACKUP_RECONCILIATION_REQUIRES_ONLINE");
    if (accessState.user()?.id !== userId) throw new Error("BACKUP_ACCOUNT_REQUIRED");
    const restoredQueueIds = await db.syncQueue
      .where("ownerUserId").equals(userId)
      .filter((item) => item.lastError === "RESTORED_BACKUP_REVIEW_REQUIRED")
      .primaryKeys();
    await db.syncQueue.bulkDelete(restoredQueueIds);
    syncService.resume(userId);
    await syncService.sync();
    const syncStatus = syncStatusStore.get();
    if (syncStatus.state !== "synced") {
      syncService.pause("backup-restore-review", userId);
      throw new Error("BACKUP_RECONCILIATION_FAILED");
    }
    await db.syncMetadata.delete(`${userId}:restore-reconciliation-required`);
    await backupRepository.update(userId, { restoreRequiresReview: false });
    await backupStatusStore.refresh();
  },
};
