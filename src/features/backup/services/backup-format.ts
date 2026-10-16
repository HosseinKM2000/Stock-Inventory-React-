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
  const snapshotRevision = await revisionForBackupData(input.data);
  const unsigned: Omit<BackupEnvelope, "integrity"> = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    snapshotRevision,
    owner: { ...input.owner, storeId: input.owner.storeId ?? input.owner.userId },
    counts: {
      products: input.data.products.length,
      categories: input.data.categories.length,
      labels: input.data.labels.length,
      pendingOperations: input.data.pendingOperations.length,
      images: input.data.images.length,
      unavailableImages: input.data.unavailableImages.length,
    },
    data: input.data,
  };
  return {
    ...unsigned,
    integrity: { algorithm: "SHA-256", digest: await sha256(envelopeWithoutIntegrity(unsigned)) },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidDataShape(value: unknown): value is BackupData {
  if (!isRecord(value)) return false;
  return Array.isArray(value.products) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.labels) &&
    Array.isArray(value.pendingOperations) &&
    Array.isArray(value.reconciliation) &&
    isRecord(value.preferences) &&
    Array.isArray(value.images) &&
    Array.isArray(value.unavailableImages);
}

export async function parseBackupEnvelope(raw: string, expectedUserId: number, expectedStoreId = expectedUserId): Promise<BackupEnvelope> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("BACKUP_INVALID_JSON");
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) throw new Error("BACKUP_FORMAT_INVALID");
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== BACKUP_SCHEMA_VERSION)) {
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
  return envelope;
}

export function serializeBackupEnvelope(envelope: BackupEnvelope) {
  return new Blob([canonicalJson(envelope)], { type: "application/vnd.tanzim.backup+json" });
}
