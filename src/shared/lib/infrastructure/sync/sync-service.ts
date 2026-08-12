import { ApiError } from "@/shared/api/api-error";
import { isAuthenticated } from "@/shared/api/token-store";

import { networkService } from "../network/network-service";

import { queueService } from "./queue.service";
import { syncStatusStore } from "./sync-status";
import type { SyncQueueItem } from "../storage/types";

export type SyncHandler = (item: SyncQueueItem) => Promise<void>;

const handlers = new Map<string, SyncHandler>();

let running: Promise<void> | null = null;

let onSettled: (() => void) | null = null;

/**
 * Entities register their own push logic so the engine stays independent from
 * feature code (and from the future backend contract).
 */
export function registerSyncHandler(entity: string, handler: SyncHandler) {
  handlers.set(entity, handler);
}

/** Called after a sync pass changes local data, so the UI can refetch. */
export function onSyncSettled(listener: () => void) {
  onSettled = listener;
}

function isPermanent(error: unknown) {
  return (
    error instanceof ApiError && error.status >= 400 && error.status < 500
    && error.status !== 408 && error.status !== 429
  );
}

async function runSync() {
  if (networkService.isOffline() || !isAuthenticated()) {
    syncStatusStore.set({
      state: "idle",
      pending: await queueService.count(),
    });

    return;
  }

  const items = await queueService.getDue();

  if (items.length === 0) {
    syncStatusStore.set({
      state: syncStatusStore.get().lastSyncedAt ? "synced" : "idle",
      pending: await queueService.count(),
      error: null,
    });

    return;
  }

  syncStatusStore.set({
    state: "syncing",
    pending: items.length,
    error: null,
  });

  let changed = false;

  let lastError: string | null = null;

  for (const item of items) {
    const handler = handlers.get(item.entity);

    if (!handler) continue;

    try {
      await handler(item);

      await queueService.remove(item.id);

      changed = true;
    } catch (error) {
      if (isPermanent(error)) {
        // The server rejected the operation for good; keeping it queued would
        // block every later change for this entity.
        await queueService.remove(item.id);
      } else {
        await queueService.markFailed(item, error);
      }

      lastError = error instanceof Error ? error.message : String(error);

      if (networkService.isOffline()) break;
    }
  }

  const pending = await queueService.count();

  syncStatusStore.set({
    state: lastError ? "failed" : "synced",

    pending,

    error: lastError,

    lastSyncedAt: lastError ? syncStatusStore.get().lastSyncedAt : Date.now(),
  });

  if (changed) onSettled?.();
}

export const syncService = {
  /** Safe to call from any trigger — concurrent calls share one pass. */
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

  /** Explicit user retry — clears backoff so failed items run immediately. */
  async retry() {
    await queueService.resetFailures();

    return this.sync();
  },

  async refreshPending() {
    syncStatusStore.set({ pending: await queueService.count() });
  },
};
