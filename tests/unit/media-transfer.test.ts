import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { ApiError } from "@/shared/api/api-error";
import type { User } from "@/features/auth/types";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/shared/lib/infrastructure/media/image.service", () => ({
  imageService: { read: mocks.read },
  isLocalImage: (path: unknown) => typeof path === "string" && path.startsWith("local://"),
}));

import { mediaTransferService } from "@/shared/lib/infrastructure/media/media-transfer.service";

function user(id: number, storeId = 44): User {
  return {
    id, store_id: storeId, is_store_owner: true,
    first_name: "Media", last_name: "Owner", username: `media-${id}`,
    email: null, phone: null, industry_id: 1, plan: "pro", is_active: true,
    is_admin: false, role: "USER", is_system_admin: false,
    subscription_started_at: null, subscription_expires_at: null,
    created_at: "2026-11-03T00:00:00Z",
  };
}

function response(transferId: string, hash: string) {
  return {
    id: "asset-1", transfer_id: transferId, version: 1,
    content_sha256: hash, mime_type: "image/webp" as const,
    byte_size: 6, width: 1, height: 1,
    preview_url: "/api/media/asset-1/preview",
    detail_url: "/api/media/asset-1/detail",
  };
}

describe("durable media transfer queue", () => {
  beforeEach(async () => {
    mocks.apiFetch.mockReset();
    mocks.read.mockReset();
    accessState.clear();
    accessState.saveUser(user(7));
    await db.open();
    await Promise.all([db.mediaTransfers.clear(), db.syncQueue.clear()]);
    mocks.read.mockResolvedValue(new Blob(["pixels"], { type: "image/webp" }));
  });

  it("reuses immutable transfer identity after a lost response and patches only a never-attempted operation", async () => {
    const job = await mediaTransferService.stage("local://product.webp", 10);
    await mediaTransferService.persist(job);
    await db.syncQueue.put({
      id: "7:product-10", ownerUserId: 7, storeId: 44,
      operationId: "operation-10", attemptState: "never", resourceKey: "product:10",
      entity: "product", entityId: 10, action: "UPDATE",
      payload: { id: 10, image_url: job.localPath, media_transfer_id: job.transferId },
      createdAt: 1, updatedAt: 1, retryCount: 0, status: "pending", nextAttemptAt: 0,
    });
    mocks.apiFetch.mockRejectedValueOnce(new Error("response lost"));
    await mediaTransferService.processDue();
    const failed = await db.mediaTransfers.get(job.id);
    expect(failed).toMatchObject({
      transferId: job.transferId, contentSha256: job.contentSha256,
      attemptState: "attempted", status: "retryable_error",
    });

    await db.mediaTransfers.update(job.id, { nextAttemptAt: 0 });
    mocks.apiFetch.mockImplementationOnce(async (_path, options) =>
      response(String(options.formData.get("transfer_id")), job.contentSha256));
    await mediaTransferService.processDue();

    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    for (const [, options] of mocks.apiFetch.mock.calls) {
      expect(options.formData.get("transfer_id")).toBe(job.transferId);
      expect(options.formData.get("content_sha256")).toBe(job.contentSha256);
    }
    expect(await db.mediaTransfers.get(job.id)).toMatchObject({ status: "uploaded", mediaAssetId: "asset-1" });
    const operation = await db.syncQueue.get("7:product-10");
    expect(operation?.payload).toEqual({ id: 10, media_transfer_id: job.transferId, media_asset_id: "asset-1" });
    expect(operation?.attemptState).toBe("never");
  });

  it("fails closed on payload mismatch and ignores a response after account switch", async () => {
    const mismatchJob = await mediaTransferService.stage("local://mismatch.webp", 11);
    await mediaTransferService.persist(mismatchJob);
    mocks.apiFetch.mockRejectedValueOnce(new ApiError(409, "MEDIA_TRANSFER_PAYLOAD_MISMATCH"));
    await mediaTransferService.processDue();
    expect(await db.mediaTransfers.get(mismatchJob.id)).toMatchObject({ status: "fatal_error" });

    const switchedJob = await mediaTransferService.stage("local://switch.webp", 12);
    await mediaTransferService.persist(switchedJob);
    mocks.apiFetch.mockImplementationOnce(async () => {
      accessState.saveUser(user(8, 55));
      return response(switchedJob.transferId, switchedJob.contentSha256);
    });
    await mediaTransferService.processDue();
    accessState.saveUser(user(7));
    expect(await db.mediaTransfers.get(switchedJob.id)).toMatchObject({
      status: "fatal_error", lastError: "MEDIA_ACCOUNT_CHANGED",
    });
  });
});
