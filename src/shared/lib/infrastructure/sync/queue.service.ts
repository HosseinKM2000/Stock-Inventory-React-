import { queueStorage } from "../storage/queue-storage";
import type { QueueAction, SyncQueueItem } from "../storage/types";

export const MAX_RETRIES = 5;

const BASE_BACKOFF_MS = 5_000;

const MAX_BACKOFF_MS = 5 * 60_000;

function queueId(entity: string, entityId: number) {
  return `${entity}-${entityId}`;
}

function mergePayload(previous: unknown, next: unknown) {
  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  if (isPlainObject(previous) && isPlainObject(next)) {
    return { ...previous, ...next };
  }

  return next;
}

/**
 * Folds a newly recorded action into the pending action for the same entity.
 * Returns `null` when the two actions cancel each other out (created and then
 * deleted while offline — the server never needs to know).
 */
export function consolidate(
  pending: SyncQueueItem | undefined,
  action: QueueAction,
  payload: unknown,
): { action: QueueAction; payload: unknown } | null {
  if (!pending) {
    return { action, payload };
  }

  if (action === "DELETE") {
    if (pending.action === "CREATE") return null;

    return { action: "DELETE", payload };
  }

  if (pending.action === "DELETE") {
    // Recreated after a pending delete — the server still holds the record.
    return { action: "UPDATE", payload };
  }

  return {
    action: pending.action,

    payload: mergePayload(pending.payload, payload),
  };
}

export function backoffDelay(retryCount: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
}

export const queueService = {
  async enqueue(
    entity: string,
    entityId: number,
    action: QueueAction,
    payload: unknown,
  ) {
    const id = queueId(entity, entityId);

    const pending = await queueStorage.get(id);

    const result = consolidate(pending, action, payload);

    if (!result) {
      await queueStorage.remove(id);

      return;
    }

    const now = Date.now();

    await queueStorage.upsert({
      id,

      entity,

      entityId,

      action: result.action,

      payload: result.payload,

      createdAt: pending?.createdAt ?? now,

      updatedAt: now,

      retryCount: 0,

      status: "pending",

      nextAttemptAt: now,
    });
  },

  async getAll() {
    return queueStorage.getAll();
  },

  async getDue(now = Date.now()) {
    const items = await queueStorage.getAll();

    return items.filter(
      (item) => item.retryCount < MAX_RETRIES && item.nextAttemptAt <= now,
    );
  },

  async count() {
    return queueStorage.count();
  },

  async markFailed(item: SyncQueueItem, error: unknown) {
    const retryCount = item.retryCount + 1;

    await queueStorage.upsert({
      ...item,

      retryCount,

      status: "failed",

      updatedAt: Date.now(),

      nextAttemptAt: Date.now() + backoffDelay(retryCount),

      lastError: error instanceof Error ? error.message : String(error),
    });
  },

  async resetFailures() {
    const items = await queueStorage.getAll();

    const now = Date.now();

    await Promise.all(
      items
        .filter((item) => item.status === "failed")
        .map((item) =>
          queueStorage.upsert({
            ...item,

            status: "pending",

            retryCount: 0,

            nextAttemptAt: now,
          }),
        ),
    );
  },

  async remove(id: string) {
    return queueStorage.remove(id);
  },

  async clear() {
    return queueStorage.clear();
  },
};
