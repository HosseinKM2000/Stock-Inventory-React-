import { accessState } from "@/shared/access/access-state";
import { apiFetch } from "@/shared/api/client";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import { storageQuotaService } from "../storage/storage-quota.service";
import { imageRepository } from "./image.repository";
import { isLocalImage } from "./image.service";

export type MediaRecoverySummary = {
  serverAvailable: number;
  localAvailable: number;
  missing: number;
  missingBytes: number;
};

function account() {
  const user = accessState.user();
  if (!user) throw new Error("MEDIA_ACCOUNT_REQUIRED");
  return { userId: user.id, storeId: user.store_id ?? user.id };
}

function assertAccount(expected: ReturnType<typeof account>) {
  const current = account();
  if (current.userId !== expected.userId || current.storeId !== expected.storeId) {
    throw new Error("MEDIA_ACCOUNT_CHANGED");
  }
}

async function digest(blob: Blob) {
  const value = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function recoverable(product: Product) {
  return Boolean(product.media_asset_id && product.media_version && product.media_content_sha256 && product.media_detail_url);
}

async function missingProducts() {
  const products = (await inventoryRepository.getAllStored()).filter(recoverable);
  const missing: Product[] = [];
  for (const product of products) {
    if (!isLocalImage(product.image_url) || !await imageRepository.exists(product.image_url)) missing.push(product);
  }
  return { products, missing };
}

async function recoverOne(product: Product, expected: ReturnType<typeof account>) {
  const detailUrl = product.media_detail_url!;
  const blob = await apiFetch<Blob>(detailUrl.startsWith("/api/") ? detailUrl.slice(4) : detailUrl, { responseType: "blob" });
  assertAccount(expected);
  if (blob.type && blob.type !== "image/webp") throw new Error("MEDIA_REMOTE_TYPE_INVALID");
  if (await digest(blob) !== product.media_content_sha256) throw new Error("MEDIA_REMOTE_HASH_MISMATCH");
  await storageQuotaService.ensureAvailable(blob.size);
  const path = await imageRepository.save(
    `media-${product.media_asset_id}-v${product.media_version}`,
    blob,
    "webp",
  );
  assertAccount(expected);
  const current = await inventoryRepository.get(product.id);
  if (
    !current || current.media_asset_id !== product.media_asset_id
    || current.media_version !== product.media_version
    || current.media_content_sha256 !== product.media_content_sha256
  ) {
    return false;
  }
  await inventoryRepository.save({ ...current, image_url: path, server_image_url: current.media_detail_url ?? current.server_image_url });
  return true;
}

export const mediaRecoveryService = {
  async summary(): Promise<MediaRecoverySummary> {
    const { products, missing } = await missingProducts();
    return {
      serverAvailable: products.length,
      localAvailable: products.length - missing.length,
      missing: missing.length,
      missingBytes: missing.reduce((sum, product) => sum + (product.media_byte_size ?? 0), 0),
    };
  },

  async downloadForOffline(onProgress?: (done: number, total: number) => void) {
    accessState.requireCapability("backup");
    accessState.requireStorePermission("tools.backup");
    const expected = account();
    const run = async () => {
      const { missing } = await missingProducts();
      let done = 0;
      const pending = [...missing];
      const workers = Array.from({ length: Math.min(2, pending.length) }, async () => {
        while (pending.length) {
          const product = pending.shift();
          if (!product) return;
          await recoverOne(product, expected);
          done += 1;
          onProgress?.(done, missing.length);
        }
      });
      await Promise.all(workers);
      return { done, total: missing.length };
    };
    if (!navigator.locks) return run();
    return navigator.locks.request(
      `tanzim-media-recovery:${expected.userId}:${expected.storeId}`,
      run,
    );
  },
};
