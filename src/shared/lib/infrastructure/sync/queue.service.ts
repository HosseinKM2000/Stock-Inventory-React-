import { queueStorage } from "../storage/queue-storage";
import type { QueueAction, SyncQueueItem } from "../storage/types";
import { accessState } from "@/shared/access/access-state";
import { requestBackgroundSync } from "./background-sync";

export const MAX_RETRIES = 5;

const BASE_BACKOFF_MS = 5_000;

const MAX_BACKOFF_MS = 5 * 60_000;
const IN_FLIGHT_LEASE_MS = 60_000;

function queueId(entity: string, entityId: number, suffix = "") {
  const owner = accessState.user()?.id;
  if (!owner) throw new Error("برای همگام‌سازی باید وارد حساب شوید");
  return `${owner}:${entity}-${entityId}${suffix}`;
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
    if (pending.status === "in_flight") {
      return { action: "DELETE", payload };
    }

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
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
  return Math.round(ceiling * (0.75 + Math.random() * 0.5));
}

export const queueService = {
  async enqueue(
    entity: string,
    entityId: number,
    action: QueueAction,
    payload: unknown,
    options: { operationId?: string } = {},
  ) {
    const existing = await queueStorage.getForEntity(entity, entityId);
    const pending = existing.find(
      (item) => item.status === "pending" || item.status === "retryable_error",
    );
    const inFlight = existing.find((item) => item.status === "in_flight");
    const id = pending?.id ?? queueId(entity, entityId, existing.length ? `:${crypto.randomUUID()}` : "");

    // Once a CREATE has crossed the claim boundary it may already exist on the
    // server. A later DELETE must survive as a follow-up operation, even when
    // another pending CREATE/UPDATE exists for the same local entity.
    const result = action === "DELETE" && inFlight
      ? { action: "DELETE" as const, payload }
      : consolidate(pending, action, payload);

    if (!result) {
      await queueStorage.remove(id);

      return;
    }

    const now = Date.now();

    const updatedAt = Math.max(now, (pending?.updatedAt ?? 0) + 1);

    await queueStorage.upsert({
      id,

      ownerUserId: accessState.user()?.id,

      operationId:
        options.operationId ?? (pending?.status === "pending" || pending?.status === "retryable_error"
          ? pending.operationId
          : crypto.randomUUID()),

      entity,

      entityId,

      action: result.action,

      payload: result.payload,

      createdAt: pending?.createdAt ?? now,

      updatedAt,

      retryCount: 0,

      status: "pending",

      nextAttemptAt: now,
    });
    void requestBackgroundSync();
    return options.operationId ?? pending?.operationId;
  },

  async getAll() {
    return queueStorage.getAll();
  },

  async getForEntity(entity: string, entityId: number) {
    return queueStorage.getForEntity(entity, entityId);
  },

  async hasForEntity(entity: string, entityId: number) {
    return (await queueStorage.getForEntity(entity, entityId)).length > 0;
  },

  async getDue(now = Date.now()) {
    const items = await queueStorage.getAll();

    return items.filter(
      (item) =>
        (item.status === "pending" ||
          item.status === "retryable_error" ||
          (item.status === "in_flight" && item.nextAttemptAt <= now)) &&
        item.retryCount < MAX_RETRIES &&
        item.nextAttemptAt <= now,
    );
  },

  async count() {
    return queueStorage.count();
  },

  async markInFlight(item: SyncQueueItem) {
    return queueStorage.claim(
      item.id,
      item.updatedAt,
      Date.now() + IN_FLIGHT_LEASE_MS,
    );
  },

  async markFailed(item: SyncQueueItem, error: unknown, fatal = false) {
    const current = await queueStorage.get(item.id);

    // A mutation may have produced a newer consolidated payload while this
    // request was in flight. Leave that newer pending item untouched.
    if (!current || current.updatedAt !== item.updatedAt) return;

    const retryCount = item.retryCount + 1;

    const status = fatal
      ? "fatal_error"
      : retryCount >= MAX_RETRIES
        ? "dead_letter"
        : "retryable_error";

    await queueStorage.upsert({
      ...item,

      retryCount,

      status,

      updatedAt: Date.now(),

      nextAttemptAt: Date.now() + backoffDelay(retryCount),

      lastError: error instanceof Error ? error.message : String(error),
    });
  },

  async releaseAfterAuthFailure(item: SyncQueueItem, error: unknown) {
    const current = await queueStorage.get(item.id);
    if (!current || current.updatedAt !== item.updatedAt) return;
    await queueStorage.upsert({
      ...item,
      status: "pending",
      nextAttemptAt: Date.now(),
      lastError: error instanceof Error ? error.message : String(error),
    });
  },

  async markConflict(item: SyncQueueItem, error: unknown) {
    const current = await queueStorage.get(item.id);

    // Preserve a newer edit recorded while the rejected request was in flight.
    // That edit has its own operation id/base version and must remain pending.
    if (!current || current.updatedAt !== item.updatedAt) return false;

    await queueStorage.upsert({
      ...item,
      status: "conflict",
      updatedAt: Date.now(),
      nextAttemptAt: Number.MAX_SAFE_INTEGER,
      lastError: error instanceof Error ? error.message : String(error),
    });
    return true;
  },

  async resetFailures() {
    const items = await queueStorage.getAll();

    const now = Date.now();

    await Promise.all(
      items
        .filter(
          (item) =>
            item.status === "retryable_error" || item.status === "dead_letter",
        )
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

  /** Avoid dropping a newer mutation queued while an older one was syncing. */
  async removeIfUnchanged(item: SyncQueueItem) {
    const current = await queueStorage.get(item.id);

    if (current?.updatedAt === item.updatedAt) {
      await queueStorage.remove(item.id);

      return true;
    }

    return false;
  },

  async clear() {
    return queueStorage.clear();
  },
};
