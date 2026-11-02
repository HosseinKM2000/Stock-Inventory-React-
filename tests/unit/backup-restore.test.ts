import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/features/auth/types";
import { buildBackupEnvelope } from "@/features/backup/services/backup-format";
import { backupRestoreService } from "@/features/backup/services/backup-restore";
import { backupRepository } from "@/features/backup/services/backup-repository";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(async () => undefined),
  restoreImage: vi.fn<(path: string, blob: Blob) => Promise<void>>(),
  readImage: vi.fn<(path: string) => Promise<Blob>>(),
  images: new Map<string, Blob>(),
  pause: vi.fn(),
  resume: vi.fn(),
  sync: vi.fn(async () => undefined),
  offline: false,
  syncState: "synced" as "synced" | "failed",
  activeUser: { id: 7, username: "owner", store_id: 7 },
  requireWrite: vi.fn(),
  requireStorePermission: vi.fn(),
  requireTool: vi.fn(),
  requireCapability: vi.fn(),
}));

vi.mock("@/features/backup/services/external-backup-adapter", () => ({
  deliverManualBackup: mocks.deliver,
  readConnectedBackup: vi.fn(),
  externalBackupMode: () => "manual",
  queryHandlePermission: vi.fn(async () => "unsupported"),
}));
vi.mock("@/shared/lib/infrastructure/media/image.repository", () => ({
  imageRepository: {
    restore: mocks.restoreImage,
    read: mocks.readImage,
    remove: vi.fn(async (path: string) => { mocks.images.delete(path); }),
  },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  syncService: { pause: mocks.pause, resume: mocks.resume, sync: mocks.sync },
}));
vi.mock("@/shared/access/access-state", () => ({
  accessState: {
    user: () => mocks.activeUser,
    requireWrite: mocks.requireWrite,
    requireStorePermission: mocks.requireStorePermission,
    requireTool: mocks.requireTool,
    requireCapability: mocks.requireCapability,
  },
}));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: () => mocks.offline },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-status", () => ({
  syncStatusStore: { get: () => ({ state: mocks.syncState }) },
}));

const user: User = {
  id: 7, username: "owner", first_name: "", last_name: "", email: null, phone: null,
  industry_id: 1, plan: "commercial", is_active: true, is_admin: false, role: "USER",
  is_system_admin: false, is_store_owner: true, store_id: 7,
  subscription_started_at: null, subscription_expires_at: null, created_at: "2026-01-01T00:00:00Z",
};

const oldOperation: SyncQueueItem = {
  id: "7:product:70", ownerUserId: 7, storeId: 7, attemptState: "uncertain",
  operationId: "historical-operation", entity: "product", entityId: 70, action: "UPDATE",
  payload: { quantity: 4, version: 2 }, createdAt: 1, updatedAt: 1, retryCount: 0,
  status: "retryable_error", nextAttemptAt: 0,
};

async function envelopeWith(options: { operations?: SyncQueueItem[]; images?: boolean } = {}) {
  return buildBackupEnvelope({
    owner: { userId: user.id, username: user.username, storeId: 7 },
    createdAt: "2026-10-13T10:00:00.000Z",
    data: {
      products: [product({ id: 70, local_user_id: 7, local_store_id: 7, quantity: 14, price: 2500, image_url: options.images ? "local://tea.webp" : null })],
      categories: [], labels: [], pendingOperations: options.operations ?? [], reconciliation: [], preferences: {},
      images: options.images ? [{ path: "local://tea.webp", mimeType: "image/webp", base64: "cGl4ZWxz" }] : [],
      unavailableImages: [], barcodes: [], inventoryMovements: [],
    },
  });
}

describe("safe backup restoration", () => {
  beforeEach(async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: async (_name: string, optionsOrCallback: unknown, maybeCallback?: (lock: object) => unknown) => {
        const callback = typeof optionsOrCallback === "function" ? optionsOrCallback as (lock: object) => unknown : maybeCallback!;
        return callback({});
      } },
    });
    await db.open();
    await db.transaction("rw", db.tables, async () => Promise.all(db.tables.map((table) => table.clear())));
    localStorage.clear();
    mocks.images.clear();
    mocks.restoreImage.mockReset().mockImplementation(async (path, blob) => { mocks.images.set(path, blob); });
    mocks.readImage.mockReset().mockImplementation(async (path) => {
      const blob = mocks.images.get(path);
      if (!blob) throw new DOMException("missing", "NotFoundError");
      return blob;
    });
    mocks.deliver.mockClear(); mocks.pause.mockClear(); mocks.resume.mockClear(); mocks.sync.mockClear();
    mocks.requireWrite.mockReset(); mocks.requireStorePermission.mockReset(); mocks.requireTool.mockReset(); mocks.requireCapability.mockReset();
    mocks.offline = false; mocks.syncState = "synced"; mocks.activeUser = { id: 7, username: "owner", store_id: 7 };
    await backupRepository.getOrCreate(user.id, "manual");
  });

  it("preserves current work in a durable checkpoint and never rewrites restored operation identity", async () => {
    const currentProduct = product({ id: 90, local_user_id: 7, local_store_id: 7, quantity: 8 });
    const currentOperation = { ...oldOperation, id: "7:product:90", entityId: 90, operationId: "current-local-work", attemptState: "never" as const, status: "pending" as const };
    await db.inventoryItems.put(currentProduct);
    await db.syncQueue.put(currentOperation);
    const transmittedPayload = { ...oldOperation.payload as object, local_user_id: 7, store_id: 7 };
    const restoredOperation = { ...oldOperation, payload: transmittedPayload };
    const envelope = await envelopeWith({ operations: [restoredOperation], images: true });

    await backupRestoreService.apply({ envelope, sourceName: "archive.tanzimbackup" }, user);

    expect(await db.inventoryItems.where("id").equals(70).first()).toMatchObject({ quantity: 14 });
    expect(await db.syncQueue.get(currentOperation.id)).toEqual(currentOperation);
    const review = await backupRestoreService.getReview(user);
    expect(review?.session.checkpoint.data.products).toEqual([currentProduct]);
    expect(review?.session.checkpoint.data.pendingOperations).toEqual([currentOperation]);
    expect(review?.session.currentWorkCount).toBe(1);
    expect(review?.items).toHaveLength(1);
    expect(review?.items[0]).toMatchObject({ classification: "uncertain", decision: "pending" });
    expect(review?.items[0].originalOperation?.operationId).toBe("historical-operation");
    expect((await backupRepository.get(7))?.restoreRequiresReview).toBe(true);
    expect(mocks.images.get("local://tea.webp")).toBeDefined();
    expect(mocks.pause).toHaveBeenCalledWith("backup-restore-review", 7);

    const first = await backupRestoreService.applyReviewItem(user, review!.items[0].id);
    const second = await backupRestoreService.applyReviewItem(user, review!.items[0].id);
    expect(first).toBe("historical-operation");
    expect(second).toBe(first);
    const queued = (await db.syncQueue.where("ownerUserId").equals(7).toArray()).filter((item) => item.operationId === first);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ attemptState: "uncertain", payload: transmittedPayload });
    expect(mocks.requireWrite).toHaveBeenCalledTimes(1);
    expect(mocks.requireStorePermission).toHaveBeenCalledWith("products.edit");
  });

  it("keeps a newer local edit and a backup-absent local product through reload and reconciliation", async () => {
    const newer = product({ id: 70, local_user_id: 7, local_store_id: 7, quantity: 27, price: 4100, version: 8 });
    const localOnly = product({ id: 91, local_user_id: 7, local_store_id: 7, quantity: 3, version: undefined });
    const newerOperation = {
      ...oldOperation, id: "7:product:70:newer", operationId: "current-newer-edit", payload: { quantity: 27, price: 4100, version: 8 },
      attemptState: "never" as const, status: "pending" as const,
    };
    const createOperation = {
      ...oldOperation, id: "7:product:91:create", entityId: 91, operationId: "current-local-create", action: "CREATE" as const,
      payload: { ...localOnly }, attemptState: "never" as const, status: "pending" as const,
    };
    await db.inventoryItems.bulkPut([newer, localOnly]);
    await db.syncQueue.bulkPut([newerOperation, createOperation]);

    await backupRestoreService.apply({ envelope: await envelopeWith(), sourceName: "older.tanzimbackup" }, user);

    expect(await db.inventoryItems.get(newer.local_key)).toMatchObject({ quantity: 27, price: 4100, version: 8 });
    expect(await db.inventoryItems.get(localOnly.local_key)).toEqual(localOnly);
    db.close();
    await db.open();
    const review = await backupRestoreService.getReview(user);
    expect(review?.session.checkpoint.data.products).toEqual(expect.arrayContaining([newer, localOnly]));
    expect(await db.syncQueue.get(newerOperation.id)).toEqual(newerOperation);
    expect(await db.syncQueue.get(createOperation.id)).toEqual(createOperation);

    await Promise.all(review!.items.map((item) => backupRestoreService.discardReviewItem(user, item.id)));
    mocks.sync.mockImplementationOnce(async () => {
      await db.syncQueue.bulkDelete([newerOperation.id, createOperation.id]);
    });
    await backupRestoreService.resumeSynchronization(user.id);

    expect(await db.inventoryItems.get(newer.local_key)).toMatchObject({ quantity: 27, price: 4100, version: 8 });
    expect(await db.inventoryItems.get(localOnly.local_key)).toEqual(localOnly);
    expect(await backupRestoreService.getReview(user)).toBeNull();
  });

  it("keeps checkpoint media bytes when an imported snapshot reuses the same local path", async () => {
    const currentBytes = new Blob(["current-image"], { type: "image/webp" });
    mocks.images.set("local://tea.webp", currentBytes);
    await db.inventoryItems.put(product({
      id: 70, local_user_id: 7, local_store_id: 7, quantity: 27, version: 8, image_url: "local://tea.webp",
    }));

    await backupRestoreService.apply({ envelope: await envelopeWith({ images: true }), sourceName: "older-media.tanzimbackup" }, user);

    expect(await mocks.images.get("local://tea.webp")!.text()).toBe("current-image");
    expect((await backupRestoreService.getReview(user))?.session.checkpoint.data.images).toHaveLength(1);
  });

  it("fails closed before mutation when Web Locks are unavailable", async () => {
    const current = product({ id: 779, local_user_id: 7, local_store_id: 7 });
    await db.inventoryItems.put(current);
    Reflect.deleteProperty(navigator, "locks");

    await expect(backupRestoreService.apply({ envelope: await envelopeWith(), sourceName: "unsupported.tanzimbackup" }, user))
      .rejects.toThrow("BACKUP_RESTORE_LOCK_UNSUPPORTED");

    expect(await db.inventoryItems.get(current.local_key)).toEqual(current);
    expect(await db.recoverySessions.count()).toBe(0);
  });

  it("never deletes restored or pre-restore work when review is incomplete", async () => {
    const current = { ...oldOperation, id: "7:current", operationId: "current", entityId: 91, attemptState: "never" as const, status: "pending" as const };
    await db.syncQueue.put(current);
    await backupRestoreService.apply({ envelope: await envelopeWith(), sourceName: "archive.tanzimbackup" }, user);
    const review = await backupRestoreService.getReview(user);
    expect(review?.items).toHaveLength(1);

    mocks.offline = true;
    await expect(backupRestoreService.resumeSynchronization(7)).rejects.toThrow("REQUIRES_ONLINE");
    mocks.offline = false;
    await expect(backupRestoreService.resumeSynchronization(7)).rejects.toThrow("REVIEW_INCOMPLETE");
    expect(await db.syncQueue.get(current.id)).toBeDefined();
    expect(await db.recoveryItems.get(review!.items[0].id)).toBeDefined();

    await backupRestoreService.discardReviewItem(user, review!.items[0].id);
    await backupRestoreService.resumeSynchronization(7);
    expect(await db.syncQueue.get(current.id)).toBeDefined();
    expect((await backupRestoreService.getReview(user))).toBeNull();
    expect((await backupRepository.get(7))?.restoreRequiresReview).toBe(false);
  });

  it("leaves live data unchanged when media staging fails", async () => {
    const current = product({ id: 99, local_user_id: 7, local_store_id: 7, quantity: 5 });
    await db.inventoryItems.put(current);
    mocks.restoreImage.mockRejectedValueOnce(new DOMException("quota", "QuotaExceededError"));

    await expect(backupRestoreService.apply({ envelope: await envelopeWith({ images: true }), sourceName: "bad.tanzimbackup" }, user)).rejects.toThrow();

    expect(await db.inventoryItems.where("id").equals(99).first()).toEqual(current);
    expect(await db.inventoryItems.where("id").equals(70).first()).toBeUndefined();
    expect(mocks.resume).toHaveBeenCalledWith(7);
  });

  it("stops safely when the authenticated account changes before commit", async () => {
    const current = product({ id: 100, local_user_id: 7, local_store_id: 7 });
    await db.inventoryItems.put(current);
    mocks.restoreImage.mockImplementationOnce(async (path, blob) => {
      mocks.images.set(path, blob);
      mocks.activeUser = { id: 8, username: "other", store_id: 8 };
    });
    await expect(backupRestoreService.apply({ envelope: await envelopeWith({ images: true }), sourceName: "switch.tanzimbackup" }, user)).rejects.toThrow("ACCOUNT_CHANGED");
    expect(await db.inventoryItems.where("id").equals(100).first()).toEqual(current);
  });

  it("keeps unknown additive outcomes unresolved and retains current conflict versions", async () => {
    const movement = {
      id: 501, operation_id: "movement-unknown", product_id: 70, actor_user_id: 7,
      actor_membership_id: null, kind: "receive" as const, delta: 2, correction_quantity: null,
      scan_source: "manual" as const, barcode_id: null, barcode_value: null, scan_quantity: 1,
      before_quantity: 12, after_quantity: 14, reverses_operation_id: null,
      sync_status: "pending" as const, created_at: "", updated_at: "",
    };
    const base = await envelopeWith();
    const envelope = await buildBackupEnvelope({
      owner: base.owner,
      data: { ...base.data, products: [{ ...base.data.products[0], version: 9 }], inventoryMovements: [movement] },
    });
    await backupRestoreService.apply({ envelope, sourceName: "movement.tanzimbackup" }, user);
    const review = await backupRestoreService.getReview(user);
    const productItem = review!.items.find((item) => item.entity === "product")!;
    const movementItem = review!.items.find((item) => item.entity === "inventory_movement")!;
    await backupRestoreService.applyReviewItem(user, productItem.id);
    const queued = (await db.syncQueue.toArray()).find((item) => item.recoverySourceId === productItem.id)!;
    expect(queued.operationId).not.toBe("movement-unknown");
    expect(queued.payload).toMatchObject({ version: 9 });
    await expect(backupRestoreService.applyReviewItem(user, movementItem.id)).rejects.toThrow("UNRESOLVED");
    expect((await db.recoveryItems.get(movementItem.id))?.decision).toBe("pending");
  });

  it("retains a resumable journal when interrupted after the database commit", async () => {
    mocks.restoreImage
      .mockImplementationOnce(async (path, blob) => { mocks.images.set(path, blob); })
      .mockRejectedValueOnce(new Error("simulated live media interruption"));
    await expect(backupRestoreService.apply({ envelope: await envelopeWith({ images: true }), sourceName: "interrupt.tanzimbackup" }, user)).rejects.toThrow("interruption");
    expect(await db.inventoryItems.where("id").equals(70).first()).toBeDefined();
    const interrupted = await backupRestoreService.getReview(user);
    expect(interrupted?.session.status).toBe("database_committed");
    expect(interrupted?.session.checkpoint).toBeDefined();

    mocks.restoreImage.mockImplementation(async (path, blob) => { mocks.images.set(path, blob); });
    await backupRestoreService.resumeInterrupted(user);
    expect((await backupRestoreService.getReview(user))?.session.status).toBe("review");
  });

  it("aborts an interrupted media-only stage without copying it into live storage", async () => {
    const envelope = await envelopeWith({ images: true });
    const staged = new Blob(["staged-only"], { type: "image/webp" });
    mocks.images.set("local://restore-staged-0.webp", staged);
    const now = Date.now();
    await db.recoverySessions.put({
      id: "restore:7:7:staged", ownerUserId: 7, storeId: 7, sourceName: "staged.tanzimbackup",
      sourceCreatedAt: envelope.createdAt, status: "media_staged", checkpoint: envelope, imported: envelope,
      media: [{ originalPath: "local://tea.webp", stagedPath: "local://restore-staged-0.webp", mimeType: "image/webp", size: staged.size, copied: false }],
      currentWorkCount: 0, unresolvedCount: 0, createdAt: now, updatedAt: now,
    });

    await backupRestoreService.resumeInterrupted(user);

    expect(mocks.images.has("local://tea.webp")).toBe(false);
    expect(mocks.images.has("local://restore-staged-0.webp")).toBe(false);
    expect(await db.recoverySessions.get("restore:7:7:staged")).toBeUndefined();
    expect(mocks.resume).toHaveBeenCalledWith(7);
  });

  it("removes a partially staged file recorded only by the preparing journal", async () => {
    const envelope = await envelopeWith({ images: true });
    const stagedPath = "local://restore-restore-7-7-preparing-0.webp";
    mocks.images.set(stagedPath, new Blob(["partial"], { type: "image/webp" }));
    const now = Date.now();
    await db.recoverySessions.put({
      id: "restore:7:7:preparing", ownerUserId: 7, storeId: 7, sourceName: "preparing.tanzimbackup",
      sourceCreatedAt: envelope.createdAt, status: "preparing", checkpoint: envelope, imported: envelope,
      media: [], currentWorkCount: 0, unresolvedCount: 0, createdAt: now, updatedAt: now,
    });

    await backupRestoreService.resumeInterrupted(user);

    expect(mocks.images.has(stagedPath)).toBe(false);
    expect(await db.recoverySessions.get("restore:7:7:preparing")).toBeUndefined();
  });

  it("blocks a concurrent local mutation while the restore boundary is active", async () => {
    let concurrentError: unknown;
    mocks.restoreImage.mockImplementationOnce(async (path, blob) => {
      mocks.images.set(path, blob);
      try { await localMutationStorage.inventory(async () => undefined); } catch (error) { concurrentError = error; }
    });
    await backupRestoreService.apply({ envelope: await envelopeWith({ images: true }), sourceName: "locked.tanzimbackup" }, user);
    expect(concurrentError).toMatchObject({ message: "BACKUP_RESTORE_MAINTENANCE" });
  });

  it("removes an expired maintenance lease instead of blocking local writes forever", async () => {
    localStorage.setItem("tanzim:7:restore-maintenance", JSON.stringify({ expiresAt: Date.now() - 1, storeId: 7 }));
    const operation = vi.fn(async () => "written");

    await expect(localMutationStorage.inventory(operation)).resolves.toBe("written");

    expect(operation).toHaveBeenCalledOnce();
    expect(localStorage.getItem("tanzim:7:restore-maintenance")).toBeNull();
  });

  it("does not touch live state when the durable checkpoint cannot be recorded", async () => {
    const current = product({ id: 777, local_user_id: 7, local_store_id: 7 });
    await db.inventoryItems.put(current);
    const put = vi.spyOn(db.recoverySessions, "put").mockRejectedValueOnce(new DOMException("quota", "QuotaExceededError"));
    await expect(backupRestoreService.apply({ envelope: await envelopeWith(), sourceName: "checkpoint.tanzimbackup" }, user)).rejects.toThrow();
    expect(await db.inventoryItems.where("id").equals(777).first()).toEqual(current);
    put.mockRestore();
  });

  it("refuses the restore before mutation when browser capacity is insufficient", async () => {
    const current = product({ id: 778, local_user_id: 7, local_store_id: 7 });
    await db.inventoryItems.put(current);
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", { configurable: true, value: { estimate: async () => ({ usage: 99, quota: 100 }) } });
    try {
      await expect(backupRestoreService.apply({ envelope: await envelopeWith(), sourceName: "full.tanzimbackup" }, user)).rejects.toThrow("QUOTA_INSUFFICIENT");
      expect(await db.inventoryItems.where("id").equals(778).first()).toEqual(current);
    } finally {
      if (descriptor) Object.defineProperty(navigator, "storage", descriptor);
      else Reflect.deleteProperty(navigator, "storage");
    }
  });
});
