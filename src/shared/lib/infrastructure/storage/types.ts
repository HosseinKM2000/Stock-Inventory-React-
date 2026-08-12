export type QueueAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE";

export type QueueStatus =
  | "pending"
  | "processing"
  | "failed";

export interface SyncQueueItem {

  id: string;

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
