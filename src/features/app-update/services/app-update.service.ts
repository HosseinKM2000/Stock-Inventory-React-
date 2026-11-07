import type { AppRelease, AppUpdateSnapshot } from "../types";

const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | null = null;
let initialized = false;
let activation: (() => void) | null = null;

let snapshot: AppUpdateSnapshot = {
  status: "idle",
  currentVersion: import.meta.env.VITE_APP_VERSION ?? "0.12.0",
  release: null,
  lastCheckedAt: null,
  canInstall: false,
  error: null,
};

function emit(patch: Partial<AppUpdateSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function isNewerVersion(latest: string, current: string) {
  const normalize = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = normalize(latest);
  const right = normalize(current);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return true;
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false;
  }
  return false;
}

async function loadRelease() {
  const response = await fetch(new URL("app-release.json", new URL(import.meta.env.BASE_URL, window.location.origin)), {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("RELEASE_UNAVAILABLE");
  return response.json() as Promise<AppRelease>;
}

async function checkForUpdate() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    emit({ status: "unsupported", lastCheckedAt: new Date().toISOString(), error: null });
    return;
  }

  emit({ status: "checking", error: null });
  try {
    const [release] = await Promise.all([
      loadRelease(),
      registration?.update(),
    ]);
    const available = Boolean(activation) || isNewerVersion(release.version, snapshot.currentVersion);
    emit({
      release,
      status: available ? "available" : "current",
      canInstall: Boolean(activation),
      lastCheckedAt: new Date().toISOString(),
      error: null,
    });
  } catch {
    emit({
      status: activation ? "available" : "error",
      canInstall: Boolean(activation),
      lastCheckedAt: new Date().toISOString(),
      error: "بررسی نسخه جدید انجام نشد. اتصال اینترنت را بررسی کنید.",
    });
  }
}

function activateUpdate() {
  if (!activation || snapshot.status === "installing") return false;
  emit({ status: "installing", canInstall: false, error: null });
  activation();
  return true;
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    emit({ status: "unsupported" });
    return;
  }

  emit({ status: "idle" });
}

export const appUpdateService = {
  initialize,
  checkForUpdate,
  activateUpdate,
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  connectRegistration(value: ServiceWorkerRegistration) {
    registration = value;
    void checkForUpdate();
  },
  notifyUpdateReady(activate: () => void) {
    activation = activate;
    emit({ status: "available", canInstall: true, error: null });
  },
};
