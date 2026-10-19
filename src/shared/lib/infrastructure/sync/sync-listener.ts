import { networkService } from "../network/network-service";
import { BACKGROUND_SYNC_TAG, requestBackgroundSync } from "./background-sync";
import { syncService } from "./sync-service";
import { entitlementService } from "@/shared/access/entitlement-service";

let started = false;

/** A synchronization runs at least this often while the application is open. */
const PERIODIC_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * The due check runs far more often than the interval itself: background tabs
 * throttle timers and a sleeping device stops them, so a single twelve-hour
 * timer would drift or never fire. Comparing elapsed wall-clock time recovers
 * the schedule shortly after the device wakes.
 */
const PERIODIC_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastSyncAttemptAt = 0;

async function verifyThenSync() {
  if (networkService.isOffline()) {
    entitlementService.markOffline();
    return;
  }
  entitlementService.markOnline();
  lastSyncAttemptAt = Date.now();
  try {
    await entitlementService.verify();
    await syncService.sync();
  } catch {
    // Authentication/account failures are handled by the API client. The
    // outbox and last valid local entitlement remain untouched.
  }
}

function syncWhenPeriodDue() {
  if (Date.now() - lastSyncAttemptAt < PERIODIC_SYNC_INTERVAL_MS) return;
  void verifyThenSync();
}

/**
 * Layered trigger strategy: startup, connectivity, focus/visibility, a
 * twelve-hour periodic refresh and (where available) Service Worker
 * Background Sync.
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
  window.setInterval(syncWhenPeriodDue, PERIODIC_CHECK_INTERVAL_MS);

  void verifyThenSync();
  void requestBackgroundSync();
}
