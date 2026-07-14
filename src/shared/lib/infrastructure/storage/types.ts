export type QueueAction =
  | "UPSERT"
  | "DELETE";

export interface SyncQueueItem {

  id: string;

  entity: string;

  entityId: number;

  action: QueueAction;

  payload: unknown;

  updatedAt: number;

}