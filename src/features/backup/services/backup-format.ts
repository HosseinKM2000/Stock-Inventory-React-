import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type BackupEnvelope,
} from "../types";

export type { BackupData } from "../types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function revisionProjection(data: BackupData) {
  const mediaPaths = [
    ...data.images.map(({ path }) => path),
    ...data.unavailableImages.map(({ path }) => path),
  ].sort();
  return {
    ...data,
    images: mediaPaths,
    unavailableImages: [],
  };
}

export function revisionForBackupData(data: BackupData) {
  return sha256(revisionProjection(data));
}

function envelopeWithoutIntegrity(envelope: Omit<BackupEnvelope, "integrity">) {
  return envelope;
}

export async function buildBackupEnvelope(input: {
  owner: BackupEnvelope["owner"];
  data: BackupData;
  createdAt?: string;
}): Promise<BackupEnvelope> {
  const data: BackupData = { ...input.data, barcodes: input.data.barcodes ?? [], inventoryMovements: input.data.inventoryMovements ?? [] };
  const snapshotRevision = await revisionForBackupData(data);
  const unsigned: Omit<BackupEnvelope, "integrity"> = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    snapshotRevision,
    owner: { ...input.owner, storeId: input.owner.storeId ?? input.owner.userId },
    counts: {
      products: data.products.length,
      categories: data.categories.length,
      labels: data.labels.length,
      barcodes: data.barcodes?.length ?? 0,
      inventoryMovements: data.inventoryMovements?.length ?? 0,
      pendingOperations: data.pendingOperations.length,
      images: data.images.length,
      unavailableImages: data.unavailableImages.length,
    },
    data,
  };
  return {
    ...unsigned,
    integrity: { algorithm: "SHA-256", digest: await sha256(envelopeWithoutIntegrity(unsigned)) },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidDataShape(value: unknown) {
  if (!isRecord(value)) return false;
  return Array.isArray(value.products) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.labels) &&
    (value.barcodes === undefined || Array.isArray(value.barcodes)) &&
    (value.inventoryMovements === undefined || Array.isArray(value.inventoryMovements)) &&
    Array.isArray(value.pendingOperations) &&
    Array.isArray(value.reconciliation) &&
    isRecord(value.preferences) &&
    Array.isArray(value.images) &&
    Array.isArray(value.unavailableImages);
}

const AUTHORITY_KEYS = new Set([
  "password", "hashed_password", "token", "access_token", "refresh_token",
  "session", "sessions", "permissions", "roles", "memberships",
  "subscription", "subscription_expires_at", "plan",
]);

function rejectsAuthority(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(rejectsAuthority);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, entry]) =>
    AUTHORITY_KEYS.has(key.toLowerCase()) || rejectsAuthority(entry));
}

function uniqueIds(items: Array<{ id: number }>, code: string) {
  const ids = new Set<number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) throw new Error(code);
    ids.add(item.id);
  }
  return ids;
}

const OPERATION_ENTITIES = new Set(["product", "category", "label", "barcode", "inventory_movement"]);
const OPERATION_ACTIONS = new Set(["CREATE", "UPDATE", "DELETE"]);

function isNonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

/** Validates business relationships and untrusted fields before live state is touched. */
export function validateBackupForRestore(envelope: BackupEnvelope, expectedUserId: number, expectedStoreId: number) {
  const data = envelope.data;
  if (rejectsAuthority(data)) throw new Error("BACKUP_AUTHORITY_FIELDS_FORBIDDEN");
  const productIds = uniqueIds(data.products, "BACKUP_PRODUCT_IDS_INVALID");
  const categoryIds = uniqueIds(data.categories, "BACKUP_CATEGORY_IDS_INVALID");
  const labelIds = uniqueIds(data.labels, "BACKUP_LABEL_IDS_INVALID");
  const barcodeIds = uniqueIds(data.barcodes ?? [], "BACKUP_BARCODE_IDS_INVALID");
  uniqueIds(data.inventoryMovements ?? [], "BACKUP_MOVEMENT_IDS_INVALID");

  for (const product of data.products) {
    if (!isRecord(product) || !isNonNegativeInteger(product.quantity) || !isNonNegativeInteger(product.price) ||
      !(product.sale_price == null || isNonNegativeInteger(product.sale_price)) ||
      !(product.purchase_price == null || isNonNegativeInteger(product.purchase_price)) ||
      !(product.label_ids == null || (Array.isArray(product.label_ids) && product.label_ids.every((id) => Number.isSafeInteger(id))))) {
      throw new Error("BACKUP_PRODUCT_INVALID");
    }
    if (product.category_id != null && !categoryIds.has(product.category_id)) throw new Error("BACKUP_RELATIONSHIP_INVALID");
    if ((product.label_ids ?? []).some((id) => !labelIds.has(id))) throw new Error("BACKUP_RELATIONSHIP_INVALID");
  }
  if (data.categories.some((item) => !isRecord(item) || typeof item.name !== "string") ||
    data.labels.some((item) => !isRecord(item) || typeof item.name !== "string")) {
    throw new Error("BACKUP_RECORD_INVALID");
  }
  for (const barcode of data.barcodes ?? []) {
    if (!isRecord(barcode) || typeof barcode.value !== "string" || !Number.isSafeInteger(barcode.product_id)) throw new Error("BACKUP_RECORD_INVALID");
    if (!productIds.has(barcode.product_id as number)) throw new Error("BACKUP_RELATIONSHIP_INVALID");
  }
  for (const movement of data.inventoryMovements ?? []) {
    if (!isRecord(movement) || !Number.isSafeInteger(movement.product_id) || !Number.isSafeInteger(movement.delta) || movement.delta === 0) {
      throw new Error("BACKUP_RECORD_INVALID");
    }
    if (!productIds.has(movement.product_id as number) || (movement.barcode_id != null && !barcodeIds.has(movement.barcode_id as number))) {
      throw new Error("BACKUP_RELATIONSHIP_INVALID");
    }
  }
  for (const item of data.pendingOperations) {
    if (!isRecord(item)) throw new Error("BACKUP_OPERATION_INVALID");
    if (item.ownerUserId != null && item.ownerUserId !== expectedUserId) throw new Error("BACKUP_OWNER_MISMATCH");
    if (item.storeId != null && item.storeId !== expectedStoreId) throw new Error("BACKUP_STORE_MISMATCH");
    if (typeof item.operationId !== "string" || !item.operationId || typeof item.entity !== "string" || !OPERATION_ENTITIES.has(item.entity) ||
      typeof item.action !== "string" || !OPERATION_ACTIONS.has(item.action) || !Number.isSafeInteger(item.entityId)) {
      throw new Error("BACKUP_OPERATION_INVALID");
    }
  }
  if (Object.values(data.preferences).some((value) => typeof value !== "string")) throw new Error("BACKUP_PREFERENCES_INVALID");
  const imagePaths = new Set<string>();
  for (const image of data.images) {
    if (!isRecord(image) || typeof image.path !== "string" || typeof image.mimeType !== "string" || typeof image.base64 !== "string" ||
      !image.path.startsWith("local://") || imagePaths.has(image.path)) throw new Error("BACKUP_IMAGE_PATH_INVALID");
    imagePaths.add(image.path);
    try { atob(image.base64); } catch { throw new Error("BACKUP_IMAGE_CORRUPT"); }
  }
  for (const image of data.unavailableImages) {
    if (!isRecord(image) || typeof image.path !== "string" || !["missing", "unreadable"].includes(String(image.reason)) ||
      !image.path.startsWith("local://") || imagePaths.has(image.path)) throw new Error("BACKUP_IMAGE_PATH_INVALID");
    imagePaths.add(image.path);
  }
}

export function normalizeBackupProducts(products: BackupData["products"]): BackupData["products"] {
  return products.map((product) => {
    const salePrice = product.sale_price === undefined
      ? (product.price_missing ? null : product.price)
      : product.sale_price;
    return {
      ...product,
      sale_price: salePrice,
      purchase_price: product.purchase_price ?? null,
      price: salePrice ?? 0,
      price_missing: salePrice == null,
    };
  });
}

export async function parseBackupEnvelope(raw: string, expectedUserId: number, expectedStoreId = expectedUserId): Promise<BackupEnvelope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("BACKUP_INVALID_JSON");
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) throw new Error("BACKUP_FORMAT_INVALID");
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION || ![1, 2, 3, BACKUP_SCHEMA_VERSION].includes(Number(parsed.schemaVersion))) {
    throw new Error("BACKUP_SCHEMA_UNSUPPORTED");
  }
  const envelope = parsed as unknown as BackupEnvelope;
  if (envelope.owner?.userId !== expectedUserId) throw new Error("BACKUP_OWNER_MISMATCH");
  if (envelope.schemaVersion >= 2 && envelope.owner.storeId !== expectedStoreId) throw new Error("BACKUP_STORE_MISMATCH");
  if (!hasValidDataShape(envelope.data) || !envelope.integrity?.digest || envelope.integrity.algorithm !== "SHA-256") {
    throw new Error("BACKUP_STRUCTURE_INVALID");
  }
  const expectedCounts = {
    products: envelope.data.products.length,
    categories: envelope.data.categories.length,
    labels: envelope.data.labels.length,
    ...(envelope.schemaVersion >= 3 ? { barcodes: envelope.data.barcodes?.length ?? 0, inventoryMovements: envelope.data.inventoryMovements?.length ?? 0 } : {}),
    pendingOperations: envelope.data.pendingOperations.length,
    images: envelope.data.images.length,
    unavailableImages: envelope.data.unavailableImages.length,
  };
  if (canonicalJson(envelope.counts) !== canonicalJson(expectedCounts)) throw new Error("BACKUP_COUNTS_INVALID");
  const { integrity, ...unsigned } = envelope;
  const digest = await sha256(unsigned);
  if (digest !== integrity.digest) throw new Error("BACKUP_INTEGRITY_FAILED");
  if (await revisionForBackupData(envelope.data) !== envelope.snapshotRevision) {
    throw new Error("BACKUP_REVISION_INVALID");
  }
  const products = normalizeBackupProducts(envelope.data.products);
  const normalized = { ...envelope, data: { ...envelope.data, products, barcodes: envelope.data.barcodes ?? [], inventoryMovements: envelope.data.inventoryMovements ?? [] } };
  validateBackupForRestore(normalized, expectedUserId, expectedStoreId);
  return normalized;
}

export function serializeBackupEnvelope(envelope: BackupEnvelope) {
  return new Blob([canonicalJson(envelope)], { type: "application/vnd.tanzim.backup+json" });
}
