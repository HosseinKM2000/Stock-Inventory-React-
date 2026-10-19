export type QueueAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE";

export type QueueStatus =
  | "pending"
  | "in_flight"
  | "retryable_error"
  | "fatal_error"
  | "dead_letter";

export interface SyncQueueItem {

  id: string;

  ownerUserId?: number;

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

}

export interface SyncMetadataItem {
  key: string;
  value: number | string | null;
  updatedAt: number;
}
