import { useSyncExternalStore } from "react";

import { networkService } from "../network/network-service";
import { syncStatusStore, type SyncEvent, type SyncStatus } from "./sync-status";

export function useOnline() {
  return useSyncExternalStore(
    (listener) => networkService.subscribe(listener),
    () => networkService.isOnline(),
    () => true,
  );
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.get(),
    () => syncStatusStore.get(),
  );
}

export function useSyncEvents(): readonly SyncEvent[] {
  return useSyncExternalStore(
    (listener) => syncStatusStore.subscribe(listener),
    () => syncStatusStore.getEvents(),
    () => syncStatusStore.getEvents(),
  );
}
