import { accessState } from "@/shared/access/access-state";
import { ApiError } from "@/shared/api/api-error";
import { apiFetch } from "@/shared/api/client";
import { db } from "../storage/db";
import type { MediaTransferItem, SyncQueueItem } from "../storage/types";
import { imageService, isLocalImage } from "./image.service";
import { recordDiagnostic } from "@/shared/lib/diagnostics/diagnostic-buffer";

export type MediaTransferResult = {
  id: string;
  transfer_id: string;
  version: number;
  content_sha256: string;
  mime_type: "image/webp";
  byte_size: number;
  width: number;
  height: number;
  preview_url: string;
  detail_url: string;
};

function scope() {
  const user = accessState.user();
  if (!user) throw new Error("MEDIA_ACCOUNT_REQUIRED");
  return { ownerUserId: user.id, storeId: user.store_id ?? user.id };
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function backoff(retryCount: number) {
  return Math.min(5_000 * 2 ** retryCount, 5 * 60_000);
}

async function scopedJobs() {
  const current = scope();
  return db.mediaTransfers.where("[ownerUserId+storeId]")
    .equals([current.ownerUserId, current.storeId]).toArray();
}

async function patchWaitingOperation(job: MediaTransferItem, result: MediaTransferResult) {
  await db.transaction("rw", [db.syncQueue, db.mediaTransfers], async () => {
    const operations = await db.syncQueue.where("ownerUserId").equals(job.ownerUserId).toArray();
    for (const operation of operations) {
      if (operation.storeId !== job.storeId || operation.entity !== "product" || operation.entityId !== job.productId) continue;
      if (operation.attemptState !== "never" || !operation.payload || typeof operation.payload !== "object") continue;
      const payload = operation.payload as Record<string, unknown>;
      if (payload.media_transfer_id !== job.transferId) continue;
      const nextPayload: Record<string, unknown> = { ...payload, media_asset_id: result.id };
      delete nextPayload.image_url;
      await db.syncQueue.put({
        ...operation,
        payload: nextPayload,
        updatedAt: Math.max(Date.now(), operation.updatedAt + 1),
      });
    }
  });
}

async function upload(job: MediaTransferItem): Promise<MediaTransferResult> {
  const current = scope();
  if (current.ownerUserId !== job.ownerUserId || current.storeId !== job.storeId) {
    throw new Error("MEDIA_ACCOUNT_CHANGED");
  }
  const blob = await imageService.read(job.localPath);
  if (blob.size !== job.byteSize || await sha256(blob) !== job.contentSha256) {
    throw new Error("MEDIA_LOCAL_CONTENT_CHANGED");
  }
  const formData = new FormData();
  formData.append("transfer_id", job.transferId);
  formData.append("content_sha256", job.contentSha256);
  formData.append("file", blob, `${job.transferId}.webp`);
  const result = await apiFetch<MediaTransferResult>("/media/transfers", { method: "POST", formData });
  const after = scope();
  if (after.ownerUserId !== job.ownerUserId || after.storeId !== job.storeId) {
    throw new Error("MEDIA_ACCOUNT_CHANGED");
  }
  return result;
}

async function processJob(job: MediaTransferItem) {
  const current = await db.mediaTransfers.get(job.id);
  if (!current || current.status === "uploaded" || current.status === "fatal_error") return current;
  const claimed: MediaTransferItem = {
    ...current,
    attemptState: "attempted",
    attemptedAt: current.attemptedAt ?? Date.now(),
    status: "in_flight",
    updatedAt: Date.now(),
  };
  await db.mediaTransfers.put(claimed);
  try {
    const result = await upload(claimed);
    if (result.content_sha256 !== claimed.contentSha256) throw new Error("MEDIA_SERVER_HASH_MISMATCH");
    const uploaded: MediaTransferItem = {
      ...claimed, status: "uploaded", mediaAssetId: result.id,
      mediaVersion: result.version, lastError: undefined, updatedAt: Date.now(),
    };
    await db.mediaTransfers.put(uploaded);
    await patchWaitingOperation(uploaded, result);
    return uploaded;
  } catch (error) {
    const retryCount = claimed.retryCount + 1;
    const fatal = error instanceof ApiError
      ? error.message === "MEDIA_TRANSFER_PAYLOAD_MISMATCH"
        || (error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status))
      : error instanceof Error && ["MEDIA_LOCAL_CONTENT_CHANGED", "MEDIA_ACCOUNT_CHANGED"].includes(error.message);
    const failed: MediaTransferItem = {
      ...claimed,
      status: fatal || retryCount >= 5 ? "fatal_error" : "retryable_error",
      retryCount,
      nextAttemptAt: Date.now() + backoff(retryCount),
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now(),
    };
    await db.mediaTransfers.put(failed);
    recordDiagnostic({
      kind: "media_failure",
      summary: error instanceof Error && /^[A-Z][A-Z0-9_.:-]+$/.test(error.message) ? error.message : "MEDIA_TRANSFER_FAILED",
      requestId: error instanceof ApiError ? error.requestId : undefined,
      operationId: claimed.transferId,
      httpStatus: error instanceof ApiError ? error.status : undefined,
    });
    return failed;
  }
}

export const mediaTransferService = {
  async stage(localPath: string, productId: number): Promise<MediaTransferItem> {
    if (!isLocalImage(localPath)) throw new Error("MEDIA_LOCAL_PATH_REQUIRED");
    const current = scope();
    const existing = (await scopedJobs()).find((item) =>
      item.productId === productId && item.localPath === localPath && item.status !== "fatal_error"
    );
    if (existing) return existing;
    const blob = await imageService.read(localPath);
    if (blob.type !== "image/webp") throw new Error("MEDIA_LOCAL_TYPE_UNSUPPORTED");
    const now = Date.now();
    const transferId = crypto.randomUUID();
    return {
      id: `${current.ownerUserId}:${current.storeId}:${transferId}`,
      ...current, transferId, productId, localPath,
      contentSha256: await sha256(blob), mimeType: "image/webp", byteSize: blob.size,
      attemptState: "never", status: "pending", retryCount: 0,
      nextAttemptAt: now, createdAt: now, updatedAt: now,
    };
  },

  persist(job: MediaTransferItem) {
    return db.mediaTransfers.put(job);
  },

  async ensureUploaded(localPath: string, productId: number) {
    const job = await this.stage(localPath, productId);
    await this.persist(job);
    const completed = await processJob(job);
    if (!completed?.mediaAssetId || completed.status !== "uploaded") {
      throw new Error(completed?.lastError ?? "MEDIA_TRANSFER_PENDING");
    }
    return completed;
  },

  async processDue(limit = 2) {
    const now = Date.now();
    const due = (await scopedJobs()).filter((item) =>
      ["pending", "retryable_error", "in_flight"].includes(item.status) && item.nextAttemptAt <= now
    ).sort((a, b) => a.createdAt - b.createdAt).slice(0, limit);
    return Promise.all(due.map(processJob));
  },

  async retryFailures() {
    const jobs = await scopedJobs();
    await Promise.all(jobs.filter((item) => item.status === "retryable_error" || item.status === "fatal_error")
      .map((item) => db.mediaTransfers.put({
        ...item, status: "pending", retryCount: 0, nextAttemptAt: Date.now(),
        lastError: undefined, updatedAt: Date.now(),
      })));
    return this.processDue();
  },

  summary: scopedJobs,
};

export function mediaOperationBlocked(item: SyncQueueItem) {
  if (item.entity !== "product" || !item.payload || typeof item.payload !== "object") return false;
  const payload = item.payload as Record<string, unknown>;
  return typeof payload.media_transfer_id === "string" && typeof payload.media_asset_id !== "string";
}
