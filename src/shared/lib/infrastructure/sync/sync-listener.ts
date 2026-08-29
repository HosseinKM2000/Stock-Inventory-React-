import { networkService } from "../network/network-service";
import { BACKGROUND_SYNC_TAG, requestBackgroundSync } from "./background-sync";
import { syncService } from "./sync-service";
import { entitlementService } from "@/shared/access/entitlement-service";

let started = false;

async function verifyThenSync() {
  if (networkService.isOffline()) {
    entitlementService.markOffline();
    return;
  }
  entitlementService.markOnline();
  try {
    await entitlementService.verify();
    await syncService.sync();
  } catch {
    // Authentication/account failures are handled by the API client. The
    // outbox and last valid local entitlement remain untouched.
  }
}

/**
 * Layered trigger strategy: startup, connectivity, focus/visibility and
 * (where available) Service Worker Background Sync.
 */
export function startSyncListeners() {
  if (started) return;
  started = true;

  entitlementService.start();

  void syncService.refreshPending();
  networkService.subscribe(() => void verifyThenSync());
  window.addEventListener("focus", () => void verifyThenSync());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void verifyThenSync();
  });
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === BACKGROUND_SYNC_TAG) void verifyThenSync();
  });

  void verifyThenSync();
  void requestBackgroundSync();
}
