import { networkService } from "../network/network-service";
import { syncService } from "./sync-service";

const BACKGROUND_SYNC_TAG = "inventory-sync";

let started = false;

function syncIfOnline() {
  if (networkService.isOnline()) {
    void syncService.sync();
  }
}

async function registerBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    const sync = (
      registration as ServiceWorkerRegistration & {
        sync?: { register(tag: string): Promise<void> };
      }
    ).sync;

    await sync?.register(BACKGROUND_SYNC_TAG);
  } catch {
    // Background Sync is an enhancement — the foreground triggers still apply.
  }
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

  syncIfOnline();

  void registerBackgroundSync();
}
