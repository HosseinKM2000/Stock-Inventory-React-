import type { User } from "@/features/auth/types";
import { isAdmin } from "@/shared/access/authorization";
import { isLocalImage } from "@/shared/lib/infrastructure/media/image.service";
import { imageRepository } from "@/shared/lib/infrastructure/media/image.repository";
import { db } from "@/shared/lib/infrastructure/storage/db";
import type { BackupData, BackupImage, BackupUnavailableImage } from "../types";
import { buildBackupEnvelope, revisionForBackupData } from "./backup-format";

function preferenceKeys(userId: number) {
  return [
    "inventory-appearance",
    `inventory:${userId}:hide-catalog-products`,
    `inventory:${userId}:profile-media-v1`,
  ];
}

function readPreferences(userId: number) {
  const preferences: Record<string, string> = {};
  for (const key of preferenceKeys(userId)) {
    const value = localStorage.getItem(key);
    if (value != null) preferences[key] = value;
  }
  return preferences;
}

function profileImagePath(preferences: Record<string, string>, userId: number) {
  try {
    const selection = JSON.parse(preferences[`inventory:${userId}:profile-media-v1`] ?? "null") as {
      kind?: string;
      path?: string;
    } | null;
    return selection?.kind === "custom" && isLocalImage(selection.path) ? selection.path : null;
  } catch {
    return null;
  }
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function readImage(path: string): Promise<BackupImage | BackupUnavailableImage> {
  try {
    const file = await imageRepository.read(path);
    return {
      path,
      mimeType: file.type || "application/octet-stream",
      base64: toBase64(await file.arrayBuffer()),
    };
  } catch (error) {
    return {
      path,
      reason: error instanceof DOMException && error.name === "NotFoundError" ? "missing" : "unreadable",
    };
  }
}

async function captureRecords(userId: number, storeId: number) {
  return db.transaction(
    "r",
    [db.inventoryItems, db.categories, db.labels, db.syncQueue, db.syncMetadata],
    async () => {
      const [products, categories, labels, pendingOperations, reconciliation] = await Promise.all([
        db.inventoryItems.where("[local_user_id+local_store_id]").equals([userId, storeId]).toArray(),
        db.categories.where("[local_user_id+local_store_id]").equals([userId, storeId]).toArray(),
        db.labels.where("[local_user_id+local_store_id]").equals([userId, storeId]).toArray(),
        db.syncQueue.where("ownerUserId").equals(userId).filter((item) => item.storeId == null || item.storeId === storeId).toArray(),
        db.syncMetadata.filter((item) => item.key.startsWith(`${userId}:${storeId}:`)).toArray(),
      ]);
      return { products, categories, labels, pendingOperations, reconciliation };
    },
  );
}

export async function captureBackupData(userId: number, includeImageBytes: boolean, storeId = userId): Promise<BackupData> {
  const records = await captureRecords(userId, storeId);
  const preferences = readPreferences(userId);
  const paths = new Set<string>();
  for (const product of records.products) {
    if (isLocalImage(product.image_url)) paths.add(product.image_url);
    if (isLocalImage(product.catalog_product?.image_url)) paths.add(product.catalog_product.image_url);
  }
  const profilePath = profileImagePath(preferences, userId);
  if (profilePath) paths.add(profilePath);

  const images: BackupImage[] = [];
  const unavailableImages: BackupUnavailableImage[] = [];
  if (includeImageBytes) {
    const results = await Promise.all([...paths].sort().map(readImage));
    for (const result of results) {
      if ("base64" in result) images.push(result);
      else unavailableImages.push(result);
    }
  } else {
    for (const path of [...paths].sort()) images.push({ path, mimeType: "", base64: "" });
  }

  return { ...records, preferences, images, unavailableImages };
}

export async function currentBackupRevision(userId: number) {
  const data = await captureBackupData(userId, false);
  const hasRecoverableData =
    data.products.length > 0 || data.categories.length > 0 || data.labels.length > 0 ||
    data.pendingOperations.length > 0 || data.images.length > 0 || Object.keys(data.preferences).length > 0;
  return { revision: await revisionForBackupData(data), hasRecoverableData };
}

export async function createBackupSnapshot(user: User) {
  if (!isAdmin(user) && user.is_store_owner === false) throw new Error("BACKUP_STORE_OWNER_REQUIRED");
  const data = await captureBackupData(user.id, true, user.store_id ?? user.id);
  return buildBackupEnvelope({
    owner: { userId: user.id, username: user.username, storeId: user.store_id ?? user.id },
    data,
  });
}
