import type { Product } from "@/features/app/inventory/types";
import type { Category, Label } from "@/features/setting/types";
import type { SyncMetadataItem, SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import type { InventoryMovement, ProductBarcode } from "@/features/barcode/types";
import type { Invoice } from "@/features/invoices/types";

export const BACKUP_FORMAT = "tanzim-local-backup" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_SCHEMA_VERSION = 5 as const;
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
  invoices?: Invoice[];
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
  invoices: number;
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

export type RecoveryClassification =
  | "snapshot"
  | "never_attempted"
  | "confirmed"
  | "uncertain"
  | "terminal";

export type RecoveryDecision = "pending" | "queued" | "resolved" | "discarded";

export type RecoveryReviewItem = {
  id: string;
  sessionId: string;
  ownerUserId: number;
  storeId: number;
  source: "backup_snapshot" | "backup_operation";
  classification: RecoveryClassification;
  decision: RecoveryDecision;
  entity: string;
  entityId: number;
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: unknown;
  originalOperation?: import("@/shared/lib/infrastructure/storage/types").SyncQueueItem;
  appliedOperationId?: string;
  createdAt: number;
  updatedAt: number;
};

export type RecoveryMediaStage = {
  originalPath: string;
  stagedPath: string;
  mimeType: string;
  size: number;
  copied: boolean;
};

export type RecoverySession = {
  id: string;
  ownerUserId: number;
  storeId: number;
  sourceName: string;
  sourceCreatedAt: string;
  status: "preparing" | "media_staged" | "database_committed" | "review" | "failed" | "complete";
  checkpoint: BackupEnvelope;
  imported: BackupEnvelope;
  media: RecoveryMediaStage[];
  currentWorkCount: number;
  unresolvedCount: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
};

export type RecoveryReview = {
  session: RecoverySession;
  items: RecoveryReviewItem[];
};
