import { beforeEach, describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), requireCapability: vi.fn(), requireStorePermission: vi.fn(),
  getAllStored: vi.fn(), get: vi.fn(), saveProduct: vi.fn(),
  apiFetch: vi.fn(), exists: vi.fn(), saveImage: vi.fn(), ensureAvailable: vi.fn(),
}));

vi.mock("@/shared/access/access-state", () => ({
  accessState: {
    user: mocks.user,
    requireCapability: mocks.requireCapability,
    requireStorePermission: mocks.requireStorePermission,
  },
}));
vi.mock("@/shared/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/features/app/inventory/services/inventory.repository", () => ({
  inventoryRepository: {
    getAllStored: mocks.getAllStored, get: mocks.get, save: mocks.saveProduct,
  },
}));
vi.mock("@/shared/lib/infrastructure/media/image.repository", () => ({
  imageRepository: { exists: mocks.exists, save: mocks.saveImage },
}));
vi.mock("@/shared/lib/infrastructure/storage/storage-quota.service", () => ({
  storageQuotaService: { ensureAvailable: mocks.ensureAvailable },
}));

import { mediaRecoveryService } from "@/shared/lib/infrastructure/media/media-recovery.service";

async function hash(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("clean-profile media recovery", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.user.mockReturnValue({ id: 1, store_id: 10 });
    mocks.exists.mockResolvedValue(false);
    mocks.ensureAvailable.mockResolvedValue(undefined);
    mocks.saveImage.mockResolvedValue("local://media-asset-1-v1.webp");
  });

  it("keeps metadata available independently and hydrates verified bytes into OPFS", async () => {
    const blob = new Blob(["verified-pixels"], { type: "image/webp" });
    const remote = product({
      id: 10, image_url: "/api/media/asset-1/detail", media_asset_id: "asset-1",
      media_version: 1, media_content_sha256: await hash(blob), media_byte_size: blob.size,
      media_detail_url: "/api/media/asset-1/detail", media_preview_url: "/api/media/asset-1/preview",
    });
    mocks.getAllStored.mockResolvedValue([remote]);
    mocks.get.mockResolvedValue(remote);
    mocks.apiFetch.mockResolvedValue(blob);

    await expect(mediaRecoveryService.summary()).resolves.toEqual({
      serverAvailable: 1, localAvailable: 0, missing: 1, missingBytes: blob.size,
    });
    await expect(mediaRecoveryService.downloadForOffline()).resolves.toEqual({ done: 1, total: 1 });
    expect(mocks.apiFetch).toHaveBeenCalledWith("/media/asset-1/detail", { responseType: "blob" });
    expect(mocks.ensureAvailable).toHaveBeenCalledWith(blob.size);
    expect(mocks.saveProduct).toHaveBeenCalledWith(expect.objectContaining({
      id: 10, image_url: "local://media-asset-1-v1.webp",
      media_asset_id: "asset-1", media_version: 1,
    }));
  });

  it("does not let a delayed download revert a newer replacement or cross an account partition", async () => {
    const blob = new Blob(["old-pixels"], { type: "image/webp" });
    const old = product({
      id: 10, image_url: "/api/media/old/detail", media_asset_id: "old",
      media_version: 1, media_content_sha256: await hash(blob), media_byte_size: blob.size,
      media_detail_url: "/api/media/old/detail",
    });
    mocks.getAllStored.mockResolvedValue([old]);
    mocks.apiFetch.mockResolvedValue(blob);
    mocks.get.mockResolvedValue(product({ ...old, media_asset_id: "new", media_version: 2 }));

    await mediaRecoveryService.downloadForOffline();
    expect(mocks.saveProduct).not.toHaveBeenCalled();

    mocks.get.mockResolvedValue(old);
    mocks.apiFetch.mockImplementationOnce(async () => {
      mocks.user.mockReturnValue({ id: 2, store_id: 20 });
      return blob;
    });
    await expect(mediaRecoveryService.downloadForOffline()).rejects.toThrow("MEDIA_ACCOUNT_CHANGED");
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });

  it("reports quota failure without claiming local availability", async () => {
    const blob = new Blob(["pixels"], { type: "image/webp" });
    const remote = product({
      image_url: "/api/media/a/detail", media_asset_id: "a", media_version: 1,
      media_content_sha256: await hash(blob), media_byte_size: blob.size,
      media_detail_url: "/api/media/a/detail",
    });
    mocks.getAllStored.mockResolvedValue([remote]);
    mocks.get.mockResolvedValue(remote);
    mocks.apiFetch.mockResolvedValue(blob);
    mocks.ensureAvailable.mockRejectedValue(new DOMException("full", "QuotaExceededError"));

    await expect(mediaRecoveryService.downloadForOffline()).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(mocks.saveImage).not.toHaveBeenCalled();
    expect(mocks.saveProduct).not.toHaveBeenCalled();
  });
});
