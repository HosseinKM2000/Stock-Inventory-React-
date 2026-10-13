import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncHandler, InboundSyncHandler } from "@/shared/lib/infrastructure/sync/sync-service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  outbound: undefined as SyncHandler | undefined,
  inbound: undefined as InboundSyncHandler | undefined,
  pushBatch: vi.fn(),
  pullChanges: vi.fn(),
  queueGet: vi.fn(),
  markConflict: vi.fn(),
  removeIfUnchanged: vi.fn(),
  metadataGet: vi.fn(),
  metadataSet: vi.fn(),
  inventoryGet: vi.fn(),
  inventoryGetAll: vi.fn(),
  inventorySave: vi.fn(),
  inventoryRemove: vi.fn(),
  imageRemove: vi.fn(),
}));

vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  registerSyncHandler: (_entity: string, handler: SyncHandler) => {
    mocks.outbound = handler;
  },
  registerInboundSyncHandler: (_entity: string, handler: InboundSyncHandler) => {
    mocks.inbound = handler;
  },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({
  queueService: {
    markConflict: mocks.markConflict,
    removeIfUnchanged: mocks.removeIfUnchanged,
    getForEntity: (...args: unknown[]) => mocks.queueGet(...args).then(
      (item: SyncQueueItem | undefined) => item ? [item] : [],
    ),
  },
}));
vi.mock("@/shared/lib/infrastructure/storage/queue-storage", () => ({
  queueStorage: { get: mocks.queueGet },
}));
vi.mock("@/shared/lib/infrastructure/storage/sync-metadata-storage", () => ({
  syncMetadataStorage: { getNumber: mocks.metadataGet, set: mocks.metadataSet },
}));
vi.mock("@/shared/lib/infrastructure/media/image.service", () => ({
  imageService: { remove: mocks.imageRemove },
}));
vi.mock("@/features/app/inventory/api/sync.api", () => ({
  pushProductBatch: mocks.pushBatch,
  pullProductChanges: mocks.pullChanges,
}));
vi.mock("@/features/app/inventory/services/inventory.repository", () => ({
  inventoryRepository: {
    get: mocks.inventoryGet,
    getAll: mocks.inventoryGetAll,
    save: mocks.inventorySave,
    remove: mocks.inventoryRemove,
  },
}));

import { registerProductSync } from "@/features/app/inventory/services/product-sync";

function queued(action: SyncQueueItem["action"] = "UPDATE"): SyncQueueItem {
  return {
    id: "1:product-10",
    ownerUserId: 1,
    operationId: "operation-10",
    entity: "product",
    entityId: 10,
    action,
    payload: product({ id: 10, quantity: 17, version: 1 }),
    createdAt: 1,
    updatedAt: 2,
    retryCount: 0,
    status: "in_flight",
    nextAttemptAt: 0,
  };
}

describe("product synchronization reconciliation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((value) => {
      if (typeof value === "function" && "mockReset" in value) value.mockReset();
    });
    mocks.outbound = undefined;
    mocks.inbound = undefined;
    mocks.inventoryGet.mockResolvedValue(product({ id: 10, quantity: 17 }));
    mocks.inventoryGetAll.mockResolvedValue([]);
    mocks.metadataGet.mockResolvedValue(1);
    mocks.metadataSet.mockResolvedValue(undefined);
    mocks.markConflict.mockResolvedValue(true);
    mocks.removeIfUnchanged.mockResolvedValue(true);
    registerProductSync();
  });

  it("keeps an offline edit recoverable when the server permanently deleted the record", async () => {
    const item = queued();
    mocks.pushBatch.mockResolvedValue({
      cursor: 4,
      results: [{
        operation_id: item.operationId,
        entity_id: item.entityId,
        status: "fatal_error",
        record: null,
        error: "PRODUCT_NOT_FOUND",
      }],
    });

    await expect(mocks.outbound?.([item])).resolves.toEqual([{
      itemId: item.id,
      status: "conflict",
      error: "PRODUCT_NOT_FOUND",
    }]);
    expect(mocks.inventoryRemove).toHaveBeenCalledWith(item.entityId);
  });

  it("reconciles the server version while reporting a normal version conflict", async () => {
    const item = queued();
    const serverRecord = product({ id: 10, quantity: 9, version: 2 });
    mocks.pushBatch.mockResolvedValue({
      cursor: 4,
      results: [{
        operation_id: item.operationId,
        entity_id: item.entityId,
        status: "conflict",
        record: serverRecord,
        error: "Server record has a newer version",
      }],
    });

    await expect(mocks.outbound?.([item])).resolves.toEqual([{
      itemId: item.id,
      status: "conflict",
      error: "Server record has a newer version",
    }]);
    expect(mocks.inventorySave).toHaveBeenCalledWith(expect.objectContaining({
      id: 10,
      quantity: 9,
      version: 2,
    }));
  });

  it("keeps a bulk-edited product after the server acknowledges its absolute payload", async () => {
    const item = queued();
    const serverRecord = product({
      id: 10, price: 250, quantity: 17, category_id: 3,
      label_ids: [4], image_url: "/uploads/product.webp", version: 2,
    });
    mocks.pushBatch.mockResolvedValue({
      cursor: 5,
      results: [{
        operation_id: item.operationId,
        entity_id: item.entityId,
        status: "applied",
        record: serverRecord,
        error: null,
      }],
    });

    await expect(mocks.outbound?.([item])).resolves.toEqual([{
      itemId: item.id, status: "applied", error: null,
    }]);
    expect(mocks.inventoryRemove).not.toHaveBeenCalled();
    expect(mocks.inventorySave).toHaveBeenCalledWith(expect.objectContaining({
      id: 10, price: 250, quantity: 17, category_id: 3, label_ids: [4], version: 2,
    }));
  });

  it("applies a server tombstone but retains the displaced edit as a conflict", async () => {
    const item = queued();
    mocks.queueGet.mockResolvedValue(item);
    mocks.pullChanges.mockResolvedValue({
      cursor: 8,
      changes: [{
        cursor: 8,
        entity: "product",
        entity_id: item.entityId,
        operation: "DELETE",
        record: null,
      }],
    });

    await mocks.inbound?.();

    expect(mocks.markConflict).toHaveBeenCalledWith(item, "PRODUCT_NOT_FOUND");
    expect(mocks.inventoryRemove).toHaveBeenCalledWith(item.entityId);
    expect(mocks.metadataSet).toHaveBeenCalledWith("product-sync-cursor", 8);
  });
});
