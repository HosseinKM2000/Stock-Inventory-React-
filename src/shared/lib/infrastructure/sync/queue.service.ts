import { queueStorage } from "../storage/queue-storage";
import { syncResourceKey, type QueueAction, type SyncQueueItem } from "../storage/types";
import { accessState } from "@/shared/access/access-state";
import { requestBackgroundSync } from "./background-sync";

export const MAX_RETRIES = 5;

const BASE_BACKOFF_MS = 5_000;

const MAX_BACKOFF_MS = 5 * 60_000;
const IN_FLIGHT_LEASE_MS = 60_000;
export const ACCESS_DENIED_OUTCOME_UNRESOLVED = "SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED";

export function isAccessDeniedOutcomeUnresolved(item: Pick<SyncQueueItem, "lastError">) {
  return item.lastError?.startsWith(`${ACCESS_DENIED_OUTCOME_UNRESOLVED}:`) ?? false;
}

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
    options: {
      operationId?: string;
      forceNew?: boolean;
      attemptState?: SyncQueueItem["attemptState"];
      attemptedAt?: number;
      recoverySourceId?: string;
      preservePolicyContext?: boolean;
      executionMode?: SyncQueueItem["executionMode"];
      policyVersion?: number;
    } = {},
  ) {
    const all = await queueStorage.getAll();
    const existing = all.filter(
      (item) => item.entity === entity && item.entityId === entityId,
    );
    const compactable = entity === "inventory_movement" || entity === "invoice" || options.forceNew
      ? undefined
      : [...existing].reverse().find(
        (item) => item.status === "pending" && item.attemptState === "never",
      );
    const resourceKey = syncResourceKey({ entity, entityId, payload });
    const latestCreatedAt = all
      .filter((item) => syncResourceKey(item) === resourceKey)
      .reduce((latest, item) => Math.max(latest, item.createdAt), 0);
    const id = compactable?.id ?? queueId(entity, entityId, existing.length ? `:${crypto.randomUUID()}` : "");
    const hasPossiblyTransmittedPredecessor = existing.some(
      (item) => item.id !== compactable?.id && item.attemptState !== "never",
    );

    // Once a CREATE has crossed the claim boundary it may already exist on the
    // server. A later DELETE must survive as a follow-up operation, even when
    // another pending CREATE/UPDATE exists for the same local entity.
    const result = action === "DELETE" && hasPossiblyTransmittedPredecessor
      ? { action: "DELETE" as const, payload }
      : consolidate(compactable, action, payload);

    if (!result) {
      await queueStorage.remove(id);

      return;
    }

    const now = Date.now();
    const user = accessState.user();
    const executionMode = options.preservePolicyContext
      ? options.executionMode
      : options.executionMode ?? compactable?.executionMode ?? user?.store_operating_mode ?? undefined;
    const policyVersion = options.preservePolicyContext
      ? options.policyVersion
      : options.policyVersion ?? compactable?.policyVersion ?? user?.store_policy_version ?? undefined;

    const updatedAt = Math.max(now, (compactable?.updatedAt ?? 0) + 1);

    await queueStorage.upsert({
      id,

      ownerUserId: accessState.user()?.id,

      attemptState: options.attemptState ?? "never",

      attemptedAt: options.attemptedAt,

      resourceKey,

      operationId:
        options.operationId ?? compactable?.operationId ?? crypto.randomUUID(),

      entity,

      entityId,

      action: result.action,

      payload: result.payload,

      createdAt: compactable?.createdAt ?? Math.max(now, latestCreatedAt + 1),

      updatedAt,

      retryCount: 0,

      status: "pending",

      nextAttemptAt: now,

      recoverySourceId: options.recoverySourceId,

      executionMode,

      policyVersion,
    });
    void requestBackgroundSync();
    return options.operationId ?? compactable?.operationId;
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
    const heads = new Map<string, SyncQueueItem>();
    for (const item of items) {
      const key = syncResourceKey(item);
      if (!heads.has(key)) heads.set(key, item);
    }

    return [...heads.values()].filter(
      (item) =>
        (item.status === "pending" ||
          item.status === "retryable_error" ||
          (item.status === "in_flight" && item.nextAttemptAt <= now)) &&
        item.retryCount < MAX_RETRIES &&
        item.nextAttemptAt <= now,
    );
  },

  async hasSuccessor(item: SyncQueueItem) {
    const operations = await queueStorage.getAll();
    const resource = syncResourceKey(item);
    const position = operations.findIndex((candidate) => candidate.id === item.id);
    if (position < 0) return false;
    return operations.slice(position + 1).some(
      (candidate) => syncResourceKey(candidate) === resource,
    );
  },

  async prepareSuccessorAfterAcknowledgement(item: SyncQueueItem, acceptedVersion: number) {
    if (item.entity === "inventory_movement" || item.entity === "invoice") return false;
    const successor = (await queueStorage.getAll()).find(
      (candidate) =>
        candidate.entity === item.entity &&
        candidate.entityId === item.entityId &&
        candidate.id !== item.id &&
        candidate.createdAt > item.createdAt &&
        candidate.status === "pending" &&
        candidate.attemptState === "never",
    );
    if (!successor || successor.action === "DELETE" || !successor.payload || typeof successor.payload !== "object") {
      return false;
    }
    await queueStorage.upsert({
      ...successor,
      payload: { ...(successor.payload as Record<string, unknown>), version: acceptedVersion },
      updatedAt: Math.max(Date.now(), successor.updatedAt + 1),
    });
    return true;
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

  /**
   * Requeue every failed item, including the ones rejected as fatal. A fatal
   * rejection often reflects server-side setup the account can correct (an
   * unset industry, a limit since raised), and only an explicit request from
   * the person reaches this code, so the work is offered again rather than
   * abandoned. Genuinely invalid payloads simply fail again.
   */
  async markAccessDeniedUnresolved(item: SyncQueueItem, error: unknown) {
    const current = await queueStorage.get(item.id);
    if (!current || current.updatedAt !== item.updatedAt) return;
    const code = error instanceof Error ? error.message : String(error);
    await queueStorage.upsert({
      ...item,
      attemptState: "uncertain",
      status: "fatal_error",
      updatedAt: Date.now(),
      nextAttemptAt: Number.MAX_SAFE_INTEGER,
      lastError: `${ACCESS_DENIED_OUTCOME_UNRESOLVED}:${code}`,
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
            item.status === "retryable_error" ||
            item.status === "dead_letter" ||
            item.status === "fatal_error",
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

  /** Makes only retryable work immediately eligible for the activation drain. */
  async prepareActivationDrain() {
    const now = Date.now();
    await Promise.all(
      (await queueStorage.getAll())
        .filter((item) => item.status === "retryable_error" && item.retryCount < MAX_RETRIES)
        .map((item) => queueStorage.upsert({ ...item, nextAttemptAt: now })),
    );
  },

  async remove(id: string) {
    return queueStorage.remove(id);
  },

  /** Avoid dropping a newer mutation queued while an older one was syncing. */
  async removeIfUnchanged(item: SyncQueueItem) {
    const current = await queueStorage.get(item.id);

    if (current?.updatedAt === item.updatedAt && current.operationId === item.operationId) {
      await queueStorage.remove(item.id);

      return true;
    }

    return false;
  },

  async clear() {
    return queueStorage.clear();
  },
};
