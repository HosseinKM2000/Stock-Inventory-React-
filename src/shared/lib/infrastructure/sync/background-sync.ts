export const BACKGROUND_SYNC_TAG = "inventory-sync";

export async function requestBackgroundSync() {
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
    // Foreground online/focus/visibility triggers remain the compatibility path.
  }
}
