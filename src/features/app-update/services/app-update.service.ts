import type { AppRelease, AppUpdateSnapshot } from "../types";
import { activateWhenSafe, type UpdateDeferral } from "./update-safety";

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

function isNewerVersion(candidate: string, current: string) {
  const parse = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const next = parse(candidate);
  const active = parse(current);
  for (let index = 0; index < Math.max(next.length, active.length); index += 1) {
    if ((next[index] ?? 0) !== (active[index] ?? 0)) return (next[index] ?? 0) > (active[index] ?? 0);
  }
  return false;
}

async function loadRelease() {
  const response = await fetch(
    new URL("app-release.json", new URL(import.meta.env.BASE_URL, window.location.origin)),
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`release:${response.status}`);
  return response.json() as Promise<AppRelease>;
}

const deferralMessages: Record<UpdateDeferral, string> = {
  unsaved_form: "یک فرم ذخیره‌نشده در یکی از تب‌ها باز است. آن را ذخیره کنید یا عمداً ببندید و دوباره تلاش کنید.",
  active_request: "یک ذخیره‌سازی در حال انجام است. پس از پایان آن دوباره تلاش کنید.",
  critical_recovery: "بازیابی یا انتقال حیاتی فایل هنوز کامل نشده است. ابتدا آن مرحله را تمام یا از بخش بازیابی ادامه دهید.",
  another_tab: "تب دیگری در حال نوشتن داده یا اعمال بروزرسانی است. آن تب را تمام کنید و دوباره تلاش کنید.",
  locking_unavailable: "این مرورگر هماهنگی امن بین تب‌ها را پشتیبانی نمی‌کند. تب‌های دیگر را ببندید و برنامه را دوباره باز کنید.",
  local_state_unavailable: "وضعیت بازیابی داده‌های محلی قابل بررسی نیست. برنامه را باز نگه دارید، تب‌های دیگر را ببندید و دوباره تلاش کنید؛ در صورت تکرار از بخش پشتیبان و بازیابی کمک بگیرید.",
};

async function checkForUpdate() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    emit({ status: "unsupported", error: null, canInstall: false });
    return;
  }
  emit({ status: "checking", error: null });
  try {
    const [release] = await Promise.all([loadRelease(), registration?.update()]);
    const ready = Boolean(activation);
    emit({
      release,
      lastCheckedAt: new Date().toISOString(),
      status: ready ? "ready" : isNewerVersion(release.version, snapshot.currentVersion) ? "checking" : "current",
      canInstall: ready,
      error: null,
    });
  } catch {
    emit({
      status: activation ? "ready" : "failed",
      canInstall: Boolean(activation),
      error: "بررسی نسخه جدید انجام نشد. نسخه فعلی همچنان قابل استفاده است؛ اتصال را بررسی و دوباره تلاش کنید.",
    });
  }
}

async function activateUpdate() {
  if (!activation || snapshot.status === "applying") return false;
  const blocked = await activateWhenSafe(activation);
  if (blocked) {
    emit({ status: "deferred", canInstall: true, error: deferralMessages[blocked] });
    return false;
  }
  emit({ status: "applying", canInstall: false, error: null });
  return true;
}

export const appUpdateService = {
  initialize() {
    if (initialized) return;
    initialized = true;
    void checkForUpdate();
  },
  checkForUpdate,
  activateUpdate,
  connectRegistration(value: ServiceWorkerRegistration) {
    registration = value;
  },
  notifyUpdateReady(callback: () => void) {
    activation = callback;
    emit({ status: "ready", canInstall: true, error: null });
  },
  notifyUpdateFailed() {
    emit({
      status: "failed",
      canInstall: Boolean(activation),
      error: "نسخه جدید کامل دریافت نشد. نسخه فعلی دست‌نخورده باقی مانده است؛ دوباره تلاش کنید.",
    });
  },
  notifyUpdateActivated(_buildId: string, activatedHere: boolean) {
    activation = null;
    if (!activatedHere) {
      emit({
        status: "deferred",
        canInstall: false,
        error: "نسخه جدید در تب دیگری فعال شد. پس از ذخیره کارهای این تب، آن را بازنشانی کنید.",
      });
    }
  },
  notifyClientMigrationFailed(blocked = false) {
    emit({
      status: blocked ? "deferred" : "failed",
      canInstall: false,
      error: blocked
        ? "ارتقای داده محلی منتظر بسته‌شدن یک تب قدیمی است. داده‌ها حذف نشده‌اند؛ تب‌های دیگر را ببندید و دوباره تلاش کنید."
        : "ارتقای داده محلی کامل نشد. داده‌ها پاک نشده‌اند؛ برنامه را نبندید و برای تلاش مجدد یا پشتیبانی از همین صفحه استفاده کنید.",
    });
  },
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
