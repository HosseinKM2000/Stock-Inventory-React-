export type ServiceWorkerLifecycle = {
  onOfflineReady?(): void;
  onUpdateReady?(activate: () => void): void;
};

export function registerServiceWorker(lifecycle: ServiceWorkerLifecycle = {}) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    let applyingUpdate = false;

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "tanzim-offline-ready") {
        lifecycle.onOfflineReady?.();
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (applyingUpdate) window.location.reload();
    });

    void navigator.serviceWorker
      .register(new URL("sw.js", base).toString(), { scope: base.pathname })
      .then((registration) => {
        const offerUpdate = (worker: ServiceWorker | null) => {
          if (!worker) return;
          lifecycle.onUpdateReady?.(() => {
            applyingUpdate = true;
            worker.postMessage({ type: "tanzim-activate-update" });
          });
        };

        offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(registration.waiting ?? worker);
            }
          });
        });

        navigator.serviceWorker.controller?.postMessage({
          type: "tanzim-check-offline-ready",
        });
      })
      .catch(() => {
        // Offline support is progressive; registration failure must not block
        // locally stored inventory or normal application startup.
      });
  });
}
