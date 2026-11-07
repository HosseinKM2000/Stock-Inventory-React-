export type ServiceWorkerLifecycle = {
  onOfflineReady?(): void;
  onUpdateReady?(activate: () => void): void;
  onUpdateActivated?(buildId: string, activatedHere: boolean): void;
  onUpdateFailed?(): void;
  onRegistered?(registration: ServiceWorkerRegistration): void;
};

export function registerServiceWorker(lifecycle: ServiceWorkerLifecycle = {}) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const base = new URL(import.meta.env.BASE_URL, window.location.origin);
    let applyingUpdate = false;
    let reloadedForActivation = false;
    const announceBuild = () => navigator.serviceWorker.controller?.postMessage({
      type: "tanzim-client-build",
      buildId: import.meta.env.VITE_BUILD_ID,
    });

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "tanzim-offline-ready") {
        lifecycle.onOfflineReady?.();
      }
      if (event.data?.type === "tanzim-update-activated") {
        lifecycle.onUpdateActivated?.(event.data.buildId, applyingUpdate);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      announceBuild();
      if (applyingUpdate && !reloadedForActivation) {
        reloadedForActivation = true;
        window.location.reload();
      }
    });

    void navigator.serviceWorker
      .register(new URL("sw.js", base).toString(), { scope: base.pathname })
      .then((registration) => {
        lifecycle.onRegistered?.(registration);
        const offerUpdate = (worker: ServiceWorker | null) => {
          if (!worker || worker.state !== "installed") return;
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
            if (worker.state === "redundant" && navigator.serviceWorker.controller) {
              lifecycle.onUpdateFailed?.();
            }
          });
        });

        announceBuild();
        navigator.serviceWorker.controller?.postMessage({
          type: "tanzim-check-offline-ready",
        });
      })
      .catch(() => {
        lifecycle.onUpdateFailed?.();
        // Offline support is progressive; registration failure must not block
        // locally stored inventory or normal application startup.
      });
  });
}
