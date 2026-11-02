import type { User } from "@/features/auth/types";
import { isAdmin } from "@/shared/access/authorization";
import { accessState } from "@/shared/access/access-state";
import { queryClient } from "@/shared/api/query-client";
import { imageRepository } from "@/shared/lib/infrastructure/media/image.repository";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { syncStatusStore } from "@/shared/lib/infrastructure/sync/sync-status";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import type { BackupEnvelope, BackupPreview, RecoveryClassification, RecoveryReview, RecoveryReviewItem, RecoverySession } from "../types";
import { parseBackupEnvelope, validateBackupForRestore } from "./backup-format";
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
  return { envelope: await parseBackupEnvelope(await file.text(), userId, storeId), sourceName: file.name };
}

const scopeFor = (user: User) => ({ ownerUserId: user.id, storeId: user.store_id ?? user.id });

function assertOwner(user: User) {
  if (!isAdmin(user) && user.is_store_owner !== true) throw new Error("BACKUP_STORE_OWNER_REQUIRED");
}

function assertActiveScope(user: User) {
  const active = accessState.user();
  const expected = scopeFor(user);
  if (!active || active.id !== expected.ownerUserId || (active.store_id ?? active.id) !== expected.storeId) {
    throw new Error("BACKUP_ACCOUNT_CHANGED");
  }
}

const maintenanceKey = (userId: number) => `tanzim:${userId}:restore-maintenance`;
const MAINTENANCE_LEASE_MS = 30 * 60_000;

function renewMaintenance(userId: number, storeId: number) {
  localStorage.setItem(maintenanceKey(userId), JSON.stringify({ startedAt: Date.now(), expiresAt: Date.now() + MAINTENANCE_LEASE_MS, storeId }));
}

function stripLocalFields(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const business = { ...payload } as Record<string, unknown>;
  delete business.local_key;
  delete business.local_user_id;
  delete business.local_store_id;
  delete business.store_id;
  return business;
}

function classifyOperation(item: SyncQueueItem): RecoveryClassification {
  if (["fatal_error", "dead_letter", "conflict"].includes(item.status)) return "terminal";
  if (item.attemptState === "never" && item.status === "pending") return "never_attempted";
  return "uncertain";
}

function reviewItem(input: Omit<RecoveryReviewItem, "id" | "createdAt" | "updatedAt" | "decision">): RecoveryReviewItem {
  const now = Date.now();
  return { ...input, id: `${input.sessionId}:item:${crypto.randomUUID()}`, decision: "pending", createdAt: now, updatedAt: now };
}

function createReviewItems(sessionId: string, envelope: BackupEnvelope, user: User): RecoveryReviewItem[] {
  const { ownerUserId, storeId } = scopeFor(user);
  const items = envelope.data.pendingOperations.map((operation) => reviewItem({
    sessionId, ownerUserId, storeId, source: "backup_operation", classification: classifyOperation(operation),
    entity: operation.entity, entityId: operation.entityId, action: operation.action,
    payload: operation.payload, originalOperation: { ...operation },
  }));
  const queued = new Set(envelope.data.pendingOperations.map((item) => `${item.entity}:${item.entityId}`));
  const add = (entity: string, records: Array<{ id: number; version?: number }>, additive = false) => {
    for (const record of records) {
      if (queued.has(`${entity}:${record.id}`)) continue;
      items.push(reviewItem({
        sessionId, ownerUserId, storeId, source: "backup_snapshot", classification: additive ? "uncertain" : "snapshot",
        entity, entityId: record.id, action: additive ? "CREATE" : typeof record.version === "number" ? "UPDATE" : "CREATE",
        payload: stripLocalFields(record),
      }));
    }
  };
  add("product", envelope.data.products);
  add("category", envelope.data.categories);
  add("label", envelope.data.labels);
  add("barcode", envelope.data.barcodes ?? []);
  add("inventory_movement", envelope.data.inventoryMovements ?? [], true);
  return items;
}

function restorePreferences(envelope: BackupEnvelope, userId: number) {
  const allowed = new Set(["inventory-appearance", `inventory:${userId}:hide-catalog-products`, `inventory:${userId}:profile-media-v1`]);
  for (const [key, value] of Object.entries(envelope.data.preferences)) if (allowed.has(key)) localStorage.setItem(key, value);
  const appearance = envelope.data.preferences["inventory-appearance"];
  if (["light", "dark", "system"].includes(appearance)) window.dispatchEvent(new CustomEvent("appearance-change", { detail: appearance }));
  window.dispatchEvent(new Event("profile-media-change"));
}

async function ensureCapacity(imported: BackupEnvelope, checkpoint: BackupEnvelope) {
  const estimate = await navigator.storage?.estimate?.();
  if (!estimate?.quota || estimate.usage == null) return;
  const bytes = [...imported.data.images, ...checkpoint.data.images].reduce((sum, image) => sum + Math.ceil(image.base64.length * 0.75), 0);
  if (estimate.quota - estimate.usage < bytes * 2 + 1_000_000) throw new Error("BACKUP_RESTORE_QUOTA_INSUFFICIENT");
}

function stagePath(sessionId: string, index: number, original: string) {
  const extension = original.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
  return `local://restore-${sessionId.replace(/[^a-z0-9]/gi, "-")}-${index}.${extension}`;
}

async function stageMedia(session: RecoverySession) {
  const media: RecoverySession["media"] = [];
  for (const [index, image] of session.imported.data.images.entries()) {
    renewMaintenance(session.ownerUserId, session.storeId);
    const blob = fromBase64(image.base64, image.mimeType);
    const stagedPath = stagePath(session.id, index, image.path);
    await imageRepository.restore(stagedPath, blob);
    if ((await imageRepository.read(stagedPath)).size !== blob.size) throw new Error("BACKUP_IMAGE_STAGE_FAILED");
    media.push({ originalPath: image.path, stagedPath, mimeType: image.mimeType, size: blob.size, copied: false });
  }
  Object.assign(session, { media, status: "media_staged" as const, updatedAt: Date.now() });
  await db.recoverySessions.put(session);
}

async function finishMedia(session: RecoverySession) {
  for (const entry of session.media) {
    if (entry.copied) continue;
    renewMaintenance(session.ownerUserId, session.storeId);
    const staged = await imageRepository.read(entry.stagedPath);
    await imageRepository.restore(entry.originalPath, staged);
    if ((await imageRepository.read(entry.originalPath)).size !== entry.size) throw new Error("BACKUP_IMAGE_RESTORE_FAILED");
    entry.copied = true;
    session.updatedAt = Date.now();
    await db.recoverySessions.put(session);
    await imageRepository.remove(entry.stagedPath).catch(() => undefined);
  }
  Object.assign(session, { status: "review" as const, updatedAt: Date.now(), lastError: undefined });
  await db.recoverySessions.put(session);
}

async function activeSession(user: User) {
  const { ownerUserId, storeId } = scopeFor(user);
  return db.recoverySessions.where("ownerUserId").equals(ownerUserId)
    .filter((session) => session.storeId === storeId && session.status !== "complete").last();
}

function remap<T extends { id: number }>(items: T[], user: User) {
  const { storeId } = scopeFor(user);
  return items.map((item) => ({ ...item, local_user_id: user.id, local_store_id: storeId, local_key: `${user.id}:${storeId}:${item.id}` }));
}

async function commitRestore(session: RecoverySession, items: RecoveryReviewItem[], user: User) {
  const data = session.imported.data;
  const { storeId } = scopeFor(user);
  renewMaintenance(user.id, storeId);
  await db.transaction("rw", [db.inventoryItems, db.categories, db.labels, db.barcodes, db.inventoryMovements, db.syncMetadata, db.recoverySessions, db.recoveryItems], async () => {
    assertActiveScope(user);
    const [products, categories, labels, barcodes, movements] = await Promise.all([
      db.inventoryItems.where("[local_user_id+local_store_id]").equals([user.id, storeId]).primaryKeys(),
      db.categories.where("[local_user_id+local_store_id]").equals([user.id, storeId]).primaryKeys(),
      db.labels.where("[local_user_id+local_store_id]").equals([user.id, storeId]).primaryKeys(),
      db.barcodes.where("[local_user_id+local_store_id]").equals([user.id, storeId]).primaryKeys(),
      db.inventoryMovements.where("[local_user_id+local_store_id]").equals([user.id, storeId]).primaryKeys(),
    ]);
    await Promise.all([db.inventoryItems.bulkDelete(products), db.categories.bulkDelete(categories), db.labels.bulkDelete(labels), db.barcodes.bulkDelete(barcodes), db.inventoryMovements.bulkDelete(movements)]);
    await db.inventoryItems.bulkPut(remap(data.products, user));
    await db.categories.bulkPut(remap(data.categories, user));
    await db.labels.bulkPut(remap(data.labels, user));
    await db.barcodes.bulkPut(remap(data.barcodes ?? [], user).map((item) => ({ ...item, store_id: storeId })));
    await db.inventoryMovements.bulkPut(remap(data.inventoryMovements ?? [], user));
    await db.recoveryItems.bulkPut(items);
    await db.syncMetadata.delete(`${user.id}:${storeId}:product-sync-cursor`);
    await db.syncMetadata.delete(`${user.id}:${storeId}:product-sync-initialized`);
    await db.syncMetadata.put({ key: `${user.id}:${storeId}:restore-reconciliation-required`, value: session.id, updatedAt: Date.now() });
    Object.assign(session, { status: "database_committed" as const, updatedAt: Date.now() });
    await db.recoverySessions.put(session);
  });
}

async function requireReview(userId: number) {
  await backupRepository.getOrCreate(userId, "manual");
  await backupRepository.update(userId, { restoreRequiresReview: true });
  await backupStatusStore.refresh();
}

function authorizeRecoverySubmission(item: RecoveryReviewItem) {
  accessState.requireWrite();
  if (item.entity === "product") {
    if (item.action === "CREATE") accessState.requireStorePermission("products.create");
    else if (item.action === "DELETE") accessState.requireStorePermission("products.delete");
    else accessState.requireStorePermission("products.edit");
    return;
  }
  if (item.entity === "category") { accessState.requireTool("categories"); return; }
  if (item.entity === "label") { accessState.requireTool("labels"); return; }
  if (item.entity === "barcode") {
    accessState.requireCapability("barcode.manage");
    accessState.requireStorePermission("barcodes.manage");
    return;
  }
  if (item.entity === "inventory_movement") {
    accessState.requireCapability("barcode.lookup");
    accessState.requireStorePermission("barcodes.lookup");
    accessState.requireStorePermission("products.quantity.change");
    return;
  }
  throw new Error("BACKUP_OPERATION_INVALID");
}

export const backupRestoreService = {
  async previewConnected(user: User) {
    const settings = await backupRepository.get(user.id);
    if (!settings) throw new Error("BACKUP_SETTINGS_NOT_FOUND");
    return previewBackupFile(await readConnectedBackup(settings), user.id, user.store_id ?? user.id);
  },

  async apply(preview: BackupPreview, user: User) {
    assertOwner(user);
    assertActiveScope(user);
    const scope = scopeFor(user);
    if (preview.envelope.owner.userId !== user.id) throw new Error("BACKUP_OWNER_MISMATCH");
    if (preview.envelope.owner.storeId != null && preview.envelope.owner.storeId !== scope.storeId) throw new Error("BACKUP_STORE_MISMATCH");
    validateBackupForRestore(preview.envelope, user.id, scope.storeId);
    if (await activeSession(user)) throw new Error("BACKUP_REVIEW_ALREADY_ACTIVE");
    const restored = await withBackupRestore(user.id, async () => {
      renewMaintenance(user.id, scope.storeId);
      syncService.pause("backup-restore-review", user.id);
      let session: RecoverySession | undefined;
      try {
        const checkpoint = await createBackupSnapshot(user);
        await ensureCapacity(preview.envelope, checkpoint);
        const now = Date.now();
        session = {
          id: `restore:${user.id}:${scope.storeId}:${crypto.randomUUID()}`, ownerUserId: user.id, storeId: scope.storeId,
          sourceName: preview.sourceName, sourceCreatedAt: preview.envelope.createdAt, status: "preparing", checkpoint,
          imported: preview.envelope, media: [], currentWorkCount: checkpoint.data.pendingOperations.length,
          unresolvedCount: 0, createdAt: now, updatedAt: now,
        };
        const items = createReviewItems(session.id, preview.envelope, user);
        session.unresolvedCount = items.length;
        await db.recoverySessions.put(session);
        await stageMedia(session);
        assertActiveScope(user);
        await commitRestore(session, items, user);
        restorePreferences(preview.envelope, user.id);
        await requireReview(user.id);
        await finishMedia(session);
        await queryClient.invalidateQueries();
        return true;
      } catch (error) {
        if (session) {
          const committed = session.status === "database_committed" || session.status === "review";
          if (!committed) session.status = "failed";
          session.lastError = error instanceof Error ? error.message : String(error);
          session.updatedAt = Date.now();
          if (committed) {
            await db.recoverySessions.put(session).catch(() => undefined);
          } else {
            for (const entry of session.media) await imageRepository.remove(entry.stagedPath).catch(() => undefined);
            await db.recoverySessions.delete(session.id).catch(() => undefined);
          }
        }
        if (!session || session.status === "failed") syncService.resume(user.id);
        throw error;
      } finally {
        localStorage.removeItem(maintenanceKey(user.id));
      }
    });
    if (!restored) throw new Error("BACKUP_RESTORE_BUSY");
  },

  async getReview(user: User): Promise<RecoveryReview | null> {
    const session = await activeSession(user);
    if (!session) return null;
    return { session, items: await db.recoveryItems.where("sessionId").equals(session.id).sortBy("createdAt") };
  },

  async resumeInterrupted(user: User) {
    assertOwner(user);
    assertActiveScope(user);
    const session = await activeSession(user);
    if (session && ["preparing", "media_staged"].includes(session.status)) {
      const aborted = await withBackupRestore(user.id, async () => {
        renewMaintenance(user.id, session.storeId);
        try {
          const stagedPaths = new Set(session.media.map((entry) => entry.stagedPath));
          session.imported.data.images.forEach((image, index) => stagedPaths.add(stagePath(session.id, index, image.path)));
          for (const path of stagedPaths) await imageRepository.remove(path).catch(() => undefined);
          await db.transaction("rw", [db.recoverySessions, db.recoveryItems], async () => {
            await db.recoveryItems.where("sessionId").equals(session.id).delete();
            await db.recoverySessions.delete(session.id);
          });
          syncService.resume(user.id);
          return true;
        } finally {
          localStorage.removeItem(maintenanceKey(user.id));
        }
      });
      if (!aborted) throw new Error("BACKUP_RESTORE_BUSY");
      return;
    }
    if (session?.status === "database_committed") {
      const resumed = await withBackupRestore(user.id, async () => {
        renewMaintenance(user.id, session.storeId);
        try {
          await finishMedia(session);
          await requireReview(user.id);
          return true;
        } finally {
          localStorage.removeItem(maintenanceKey(user.id));
        }
      });
      if (!resumed) throw new Error("BACKUP_RESTORE_BUSY");
    }
  },

  async applyReviewItem(user: User, itemId: string) {
    assertOwner(user);
    assertActiveScope(user);
    const session = await activeSession(user);
    const item = await db.recoveryItems.get(itemId);
    if (!item || !session || item.sessionId !== session.id || item.ownerUserId !== user.id || item.storeId !== (user.store_id ?? user.id)) throw new Error("BACKUP_REVIEW_ITEM_NOT_FOUND");
    if (item.appliedOperationId) return item.appliedOperationId;
    if (item.classification === "terminal" || (item.entity === "inventory_movement" && item.source === "backup_snapshot")) throw new Error("BACKUP_REVIEW_ITEM_UNRESOLVED");
    authorizeRecoverySubmission(item);
    return localMutationStorage.recovery(async () => {
      const fresh = await db.recoveryItems.get(item.id);
      if (!fresh || fresh.appliedOperationId) return fresh?.appliedOperationId;
      const replay = fresh.classification === "uncertain" && fresh.originalOperation;
      const operationId = replay ? fresh.originalOperation!.operationId : crypto.randomUUID();
      await queueService.enqueue(fresh.entity, fresh.entityId, fresh.action, fresh.payload, {
        operationId, forceNew: true, attemptState: replay ? (fresh.originalOperation!.attemptState ?? "uncertain") : "never",
        attemptedAt: replay ? fresh.originalOperation!.attemptedAt : undefined, recoverySourceId: fresh.id,
      });
      Object.assign(fresh, { appliedOperationId: operationId, decision: "queued" as const, updatedAt: Date.now() });
      await db.recoveryItems.put(fresh);
      return operationId;
    });
  },

  async discardReviewItem(user: User, itemId: string) {
    assertOwner(user);
    assertActiveScope(user);
    await localMutationStorage.recovery(async () => {
      const item = await db.recoveryItems.get(itemId);
      if (!item || item.ownerUserId !== user.id || item.storeId !== (user.store_id ?? user.id)) throw new Error("BACKUP_REVIEW_ITEM_NOT_FOUND");
      if (item.appliedOperationId) {
        const queued = (await queueService.getAll()).find((candidate) => candidate.operationId === item.appliedOperationId);
        if (!queued || queued.attemptState !== "never" || queued.status !== "pending") throw new Error("BACKUP_DISCARD_ALREADY_ATTEMPTED");
        await queueService.remove(queued.id);
      }
      Object.assign(item, { decision: "discarded" as const, updatedAt: Date.now() });
      await db.recoveryItems.put(item);
    });
  },

  async exportRecovery(user: User) {
    assertOwner(user);
    assertActiveScope(user);
    const review = await this.getReview(user);
    if (!review) throw new Error("BACKUP_REVIEW_NOT_FOUND");
    const evidence = { format: "tanzim-recovery-evidence", version: 1, exportedAt: new Date().toISOString(), owner: scopeFor(user), session: review.session, items: review.items };
    await deliverManualBackup(new Blob([JSON.stringify(evidence)], { type: "application/json" }));
  },

  async resumeSynchronization(userId: number) {
    if (networkService.isOffline()) throw new Error("BACKUP_RECONCILIATION_REQUIRES_ONLINE");
    const user = accessState.user();
    if (!user || user.id !== userId) throw new Error("BACKUP_ACCOUNT_REQUIRED");
    const review = await this.getReview(user as User);
    if (!review) throw new Error("BACKUP_REVIEW_NOT_FOUND");
    if (review.items.some((item) => item.decision === "pending")) throw new Error("BACKUP_REVIEW_INCOMPLETE");
    syncService.resume(userId);
    await syncService.sync();
    const queued = new Map((await queueService.getAll()).map((item) => [item.operationId, item]));
    let unresolved = false;
    for (const item of review.items) {
      if (item.decision !== "queued" || !item.appliedOperationId) continue;
      if (queued.has(item.appliedOperationId)) { unresolved = true; continue; }
      Object.assign(item, { decision: "resolved" as const, updatedAt: Date.now() });
      await db.recoveryItems.put(item);
    }
    if (unresolved || syncStatusStore.get().state !== "synced") {
      syncService.pause("backup-restore-review", userId);
      throw new Error("BACKUP_RECONCILIATION_FAILED");
    }
    Object.assign(review.session, { status: "complete" as const, unresolvedCount: 0, updatedAt: Date.now() });
    await db.recoverySessions.put(review.session);
    await db.syncMetadata.delete(`${review.session.ownerUserId}:${review.session.storeId}:restore-reconciliation-required`);
    await backupRepository.update(userId, { restoreRequiresReview: false });
    await backupStatusStore.refresh();
  },
};
