import { ApiError } from "@/shared/api/api-error";
import { isAuthenticated } from "@/shared/api/token-store";

import { networkService } from "../network/network-service";
import type { SyncQueueItem } from "../storage/types";
import { queueService } from "./queue.service";
import { syncStatusStore } from "./sync-status";
import { accessState } from "@/shared/access/access-state";

export type SyncHandlerResult = {
  itemId: string;
  status: "applied" | "conflict" | "fatal_error";
  error?: string | null;
};

export type SyncHandler = (
  items: SyncQueueItem[],
) => Promise<SyncHandlerResult[]>;

export type InboundSyncHandler = () => Promise<void>;

const handlers = new Map<string, SyncHandler>();
const inboundHandlers = new Map<string, InboundSyncHandler>();

let running: Promise<void> | null = null;
let onSettled: (() => void) | null = null;

export function registerSyncHandler(entity: string, handler: SyncHandler) {
  handlers.set(entity, handler);
}

export function registerInboundSyncHandler(
  entity: string,
  handler: InboundSyncHandler,
) {
  inboundHandlers.set(entity, handler);
}

export function onSyncSettled(listener: () => void) {
  onSettled = listener;
}

function isFatalRequest(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 423 &&
    error.status !== 408 &&
    error.status !== 409 &&
    error.status !== 429 &&
    error.message !== "SUBSCRIPTION_EXPIRED"
  );
}

async function processGroup(entity: string, items: SyncQueueItem[]) {
  const handler = handlers.get(entity);
  if (!handler) return { changed: false, error: null as string | null };

  const active: SyncQueueItem[] = [];
  for (const item of items) {
    if (await queueService.markInFlight(item)) active.push(item);
  }
  if (active.length === 0) return { changed: false, error: null };

  try {
    const results = await handler(active);
    const byId = new Map(results.map((result) => [result.itemId, result]));
    let lastError: string | null = null;

    for (const item of active) {
      const result = byId.get(item.id);

      if (!result) {
        const error = new Error("Sync server omitted an operation result");
        await queueService.markFailed(item, error);
        lastError = error.message;
      } else if (result.status === "applied" || result.status === "conflict") {
        await queueService.removeIfUnchanged(item);
        if (result.status === "conflict") lastError = result.error ?? "Sync conflict";
      } else {
        const error = new Error(result.error ?? "Server rejected the operation");
        await queueService.markFailed(item, error, true);
        lastError = error.message;
      }
    }

    return { changed: true, error: lastError };
  } catch (error) {
    for (const item of active) {
      await queueService.markFailed(item, error, isFatalRequest(error));
    }

    return {
      changed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSync() {
  if (networkService.isOffline() || !isAuthenticated()) {
    syncStatusStore.set({ state: "idle", pending: await queueService.count() });
    return;
  }

  if (!accessState.canAccess()) {
    syncStatusStore.set({
      state: "failed",
      pending: await queueService.count(),
      error: "ACCOUNT_DISABLED",
    });
    return;
  }

  const writeAllowed = accessState.canWrite();
  const items = writeAllowed ? await queueService.getDue() : [];

  syncStatusStore.set({ state: "syncing", pending: items.length, error: null });

  let changed = false;
  let lastError: string | null = writeAllowed ? null : "SUBSCRIPTION_EXPIRED";

  const groups = new Map<string, SyncQueueItem[]>();
  for (const item of items) {
    groups.set(item.entity, [...(groups.get(item.entity) ?? []), item]);
  }

  for (const [entity, group] of groups) {
    const result = await processGroup(entity, group);
    changed ||= result.changed;
    lastError = result.error ?? lastError;
    if (networkService.isOffline()) break;
  }

  if (networkService.isOnline()) {
    for (const handler of inboundHandlers.values()) {
      try {
        await handler();
        changed = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (networkService.isOffline()) break;
      }
    }
  }

  const queued = await queueService.getAll();
  const terminal = queued.find(
    (item) => item.status === "fatal_error" || item.status === "dead_letter",
  );

  syncStatusStore.set({
    state: lastError || terminal ? "failed" : "synced",
    pending: queued.length,
    error: lastError ?? terminal?.lastError ?? null,
    lastSyncedAt: lastError ? syncStatusStore.get().lastSyncedAt : Date.now(),
  });

  if (changed) onSettled?.();
}

export const syncService = {
  async sync() {
    if (running) return running;

    running = runSync()
      .catch((error) => {
        syncStatusStore.set({
          state: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = null;
      });

    return running;
  },

  async retry() {
    await queueService.resetFailures();
    return this.sync();
  },

  async refreshPending() {
    syncStatusStore.set({ pending: await queueService.count() });
  },
};
