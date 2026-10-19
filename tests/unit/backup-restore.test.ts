import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/features/auth/types";
import { buildBackupEnvelope } from "@/features/backup/services/backup-format";
import { backupRestoreService } from "@/features/backup/services/backup-restore";
import { backupRepository } from "@/features/backup/services/backup-repository";
import { db } from "@/shared/lib/infrastructure/storage/db";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(async () => undefined),
  restoreImage: vi.fn<(path: string, blob: Blob) => Promise<void>>().mockResolvedValue(undefined),
  readImage: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  sync: vi.fn(async () => undefined),
  offline: false,
  syncState: "synced" as "synced" | "failed",
}));

vi.mock("@/features/backup/services/external-backup-adapter", () => ({
  deliverManualBackup: mocks.deliver,
  readConnectedBackup: vi.fn(),
  externalBackupMode: () => "manual",
  queryHandlePermission: vi.fn(async () => "unsupported"),
}));
vi.mock("@/shared/lib/infrastructure/media/image.repository", () => ({
  imageRepository: { restore: mocks.restoreImage, read: mocks.readImage },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  syncService: { pause: mocks.pause, resume: mocks.resume, sync: mocks.sync },
}));
vi.mock("@/shared/access/access-state", () => ({
  accessState: { user: () => ({ id: 7, username: "owner" }) },
}));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: () => mocks.offline },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-status", () => ({
  syncStatusStore: { get: () => ({ state: mocks.syncState }) },
}));

const user: User = {
  id: 7,
  username: "owner",
  first_name: "",
  last_name: "",
  email: null,
  phone: null,
  industry_id: 1,
  plan: "commercial",
  is_active: true,
  is_admin: false,
  role: "USER",
  is_system_admin: false,
  subscription_started_at: null,
  subscription_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const oldOperation: SyncQueueItem = {
  id: "7:product:70",
  ownerUserId: 7,
  operationId: "historical-operation",
  entity: "product",
  entityId: 70,
  action: "UPDATE",
  payload: { quantity: 4 },
  createdAt: 1,
  updatedAt: 1,
  retryCount: 0,
  status: "pending",
  nextAttemptAt: 0,
};

describe("backup restoration", () => {
  beforeEach(async () => {
    await db.open();
    await db.transaction("rw", db.tables, async () => Promise.all(db.tables.map((table) => table.clear())));
    mocks.deliver.mockClear();
    mocks.restoreImage.mockClear();
    mocks.pause.mockClear();
    mocks.resume.mockClear();
    mocks.sync.mockClear();
    mocks.offline = false;
    mocks.syncState = "synced";
  });

  it("round-trips account data and images while quarantining historical outbox work", async () => {
    await db.inventoryItems.put(product({ id: 990, local_user_id: 99 }));
    await backupRepository.getOrCreate(user.id, "manual");
    const restoredProduct = product({
      id: 70,
      local_user_id: 7,
      category_id: 8,
      label_ids: [9],
      quantity: 14,
      price: 2500,
      image_url: "local://tea.webp",
    });
    const envelope = await buildBackupEnvelope({
      owner: { userId: user.id, username: user.username },
      createdAt: "2026-10-13T10:00:00.000Z",
      data: {
        products: [restoredProduct],
        categories: [{ id: 8, local_user_id: 7, name: "نوشیدنی", description: "", created_at: "", updated_at: "" }],
        labels: [{ id: 9, local_user_id: 7, name: "چای", normalized_name: "چای", created_at: "", updated_at: "" }],
        pendingOperations: [oldOperation],
        reconciliation: [{ key: "7:cursor", value: "old-cursor", updatedAt: 1 }],
        preferences: { "inventory:7:hide-catalog-products": "true" },
        images: [{ path: "local://tea.webp", mimeType: "image/webp", base64: "cGl4ZWxz" }],
        unavailableImages: [],
      },
    });

    await backupRestoreService.apply({ envelope, sourceName: "archive.tanzimbackup" }, user);

    expect(await db.inventoryItems.get(70)).toMatchObject({ quantity: 14, category_id: 8, label_ids: [9] });
    expect(await db.categories.get(8)).toMatchObject({ name: "نوشیدنی", local_user_id: 7 });
    expect(await db.labels.get(9)).toMatchObject({ name: "چای", local_user_id: 7 });
    expect(await db.inventoryItems.get(990)).toBeDefined();
    const queue = await db.syncQueue.where("ownerUserId").equals(7).toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ status: "conflict", lastError: "RESTORED_BACKUP_REVIEW_REQUIRED" });
    expect(queue[0].operationId).not.toBe("historical-operation");
    expect(await db.syncMetadata.get("7:cursor")).toBeUndefined();
    expect(await db.syncMetadata.get("7:restore-reconciliation-required")).toBeDefined();
    expect((await backupRepository.get(7))?.restoreRequiresReview).toBe(true);
    expect(mocks.restoreImage).toHaveBeenCalledOnce();
    await expect((mocks.restoreImage.mock.calls[0][1] as Blob).text()).resolves.toBe("pixels");
    expect(mocks.pause).toHaveBeenCalledWith("backup-restore-review", 7);
    expect(mocks.deliver).toHaveBeenCalledOnce();
  });

  it("keeps reconciliation paused offline and discards quarantined history only after online review", async () => {
    await backupRepository.getOrCreate(user.id, "manual");
    await backupRepository.update(user.id, { restoreRequiresReview: true });
    await db.syncQueue.put({ ...oldOperation, status: "conflict", lastError: "RESTORED_BACKUP_REVIEW_REQUIRED" });
    await db.syncMetadata.put({ key: "7:restore-reconciliation-required", value: "pending", updatedAt: 1 });

    mocks.offline = true;
    await expect(backupRestoreService.resumeSynchronization(7)).rejects.toThrow("REQUIRES_ONLINE");
    expect(await db.syncQueue.get(oldOperation.id)).toBeDefined();
    expect((await backupRepository.get(7))?.restoreRequiresReview).toBe(true);

    mocks.offline = false;
    await backupRestoreService.resumeSynchronization(7);
    expect(await db.syncQueue.get(oldOperation.id)).toBeUndefined();
    expect(await db.syncMetadata.get("7:restore-reconciliation-required")).toBeUndefined();
    expect((await backupRepository.get(7))?.restoreRequiresReview).toBe(false);
    expect(mocks.resume).toHaveBeenCalledWith(7);
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
});
