export type QueueAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE";

export type QueueStatus =
  | "pending"
  | "in_flight"
  | "retryable_error"
  | "conflict"
  | "fatal_error"
  | "dead_letter";

export type QueueAttemptState = "never" | "attempted" | "uncertain";

export interface SyncQueueItem {

  id: string;

  ownerUserId?: number;
  storeId?: number;

  /** Missing on legacy/backup records and therefore treated as uncertain. */
  attemptState?: QueueAttemptState;

  attemptedAt?: number;

  /** Orders operations that affect the same logical server resource. */
  resourceKey?: string;

  operationId: string;

  entity: string;

  entityId: number;

  action: QueueAction;

  payload: unknown;

  createdAt: number;

  updatedAt: number;

  retryCount: number;

  status: QueueStatus;

  nextAttemptAt: number;

  lastError?: string;

  /** Links an explicitly approved recovery action to its immutable source evidence. */
  recoverySourceId?: string;

  /** Server policy context captured before dispatch; immutable after attempt. */
  executionMode?: "solo" | "team";

  policyVersion?: number;

}

export function syncResourceKey(
  item: Pick<SyncQueueItem, "entity" | "entityId" | "payload" | "resourceKey">,
) {
  if (item.resourceKey) return item.resourceKey;
  if (item.entity === "inventory_movement" && item.payload && typeof item.payload === "object") {
    const productId = (item.payload as { product_id?: unknown }).product_id;
    if (typeof productId === "number") return `product:${productId}`;
  }
  return `${item.entity}:${item.entityId}`;
}

export interface SyncMetadataItem {
  key: string;
  value: number | string | null;
  updatedAt: number;
}
