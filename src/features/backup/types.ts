import type { Product } from "@/features/app/inventory/types";
import type { Category, Label } from "@/features/setting/types";
import type { SyncMetadataItem, SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import type { InventoryMovement, ProductBarcode } from "@/features/barcode/types";

export const BACKUP_FORMAT = "tanzim-local-backup" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_SCHEMA_VERSION = 3 as const;
export const DEFAULT_BACKUP_INTERVAL_MS = 5 * 60_000;

export type BackupMode = "directory" | "file" | "manual";
export type BackupPermission = PermissionState | "unsupported" | "missing";

export type BackupImage = {
  path: string;
  mimeType: string;
  base64: string;
};

export type BackupUnavailableImage = {
  path: string;
  reason: "missing" | "unreadable";
};

export type BackupData = {
  products: Product[];
  categories: Category[];
  labels: Label[];
  barcodes?: ProductBarcode[];
  inventoryMovements?: InventoryMovement[];
  pendingOperations: SyncQueueItem[];
  reconciliation: SyncMetadataItem[];
  preferences: Record<string, string>;
  images: BackupImage[];
  unavailableImages: BackupUnavailableImage[];
};

export type BackupCounts = {
  products: number;
  categories: number;
  labels: number;
  barcodes: number;
  inventoryMovements: number;
  pendingOperations: number;
  images: number;
  unavailableImages: number;
};

export type BackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  createdAt: string;
  snapshotRevision: string;
  owner: { userId: number; username: string; storeId?: number };
  counts: BackupCounts;
  data: BackupData;
  integrity: { algorithm: "SHA-256"; digest: string };
};

export type BackupSettings = {
  userId: number;
  mode: BackupMode;
  onboardingCompleted: boolean;
  automaticEnabled: boolean;
  intervalMs: number;
  destinationName?: string;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  permission: BackupPermission;
  lastSuccessfulAt: number | null;
  lastSuccessfulRevision: string | null;
  lastFailure: string | null;
  retryCount: number;
  nextAttemptAt: number;
  restoreRequiresReview: boolean;
};

export type BackupStatus = {
  settings: BackupSettings | null;
  currentRevision: string | null;
  hasRecoverableData: boolean;
  dirty: boolean;
  busy: boolean;
};

export type BackupPreview = {
  envelope: BackupEnvelope;
  sourceName: string;
};
