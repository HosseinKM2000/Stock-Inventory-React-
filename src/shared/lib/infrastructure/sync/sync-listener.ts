import { networkService } from "../network/network-service";
import { BACKGROUND_SYNC_TAG, requestBackgroundSync } from "./background-sync";
import { syncService } from "./sync-service";

let started = false;

function syncIfOnline() {
  if (networkService.isOnline()) void syncService.sync();
}

/**
 * Layered trigger strategy: startup, connectivity, focus/visibility and
 * (where available) Service Worker Background Sync.
 */
export function startSyncListeners() {
  if (started) return;
  started = true;

  void syncService.refreshPending();
  networkService.subscribe(syncIfOnline);
  window.addEventListener("focus", syncIfOnline);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncIfOnline();
  });
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === BACKGROUND_SYNC_TAG) syncIfOnline();
  });

  syncIfOnline();
  void requestBackgroundSync();
}
