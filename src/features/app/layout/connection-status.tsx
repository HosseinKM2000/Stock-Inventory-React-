import { notifySubscriptionRestriction } from "@/shared/access/subscription-limit";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import type { SyncStatus } from "@/shared/lib/infrastructure/sync/sync-status";
import {
  useOnline,
  useSyncStatus,
} from "@/shared/lib/infrastructure/sync/use-sync-status";
import { ArchiveIcon, CheckIcon, ClockIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Tooltip } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_REVEAL_DURATION_MS = 4_000;

export type SyncIndicator = {
  kind: "idle" | "pending" | "syncing" | "success" | "error";
  label: string;
  tooltip: string;
};

export type SyncHeaderAction =
  | { kind: "sync" | "retry"; label: "ارسال" | "تلاش" }
  | { kind: "details" | "recovery"; label: "بررسی" | "بازیابی"; to: "/setting/sync" | "/setting/backup" };

export function getCompactSyncLabel(status: SyncStatus, online: boolean) {
  if (!online) return status.pending > 0 ? `${status.pending.toLocaleString("fa-IR")} صف` : "آفلاین";
  if (status.state === "syncing") return "ارسال";
  if (status.error === "SYNC_PAUSED_FOR_RESTORE") return "مکث";
  if (status.state === "conflict") return "تعارض";
  if (status.state === "failed") return "خطا";
  if (status.pending > 0) return `${status.pending.toLocaleString("fa-IR")} صف`;
  if (status.state === "synced") return "همگام";
  return "آماده";
}

export function getSyncHeaderAction(status: SyncStatus, online: boolean): SyncHeaderAction | null {
  if (!online || status.state === "syncing") return null;
  if (status.error === "SYNC_PAUSED_FOR_RESTORE") {
    return { kind: "recovery", label: "بازیابی", to: "/setting/backup" };
  }
  if (status.state === "conflict") {
    return { kind: "details", label: "بررسی", to: "/setting/sync" };
  }
  if (status.state === "failed") {
    const retryable = status.pending > 0 || /network|fetch|offline|timeout/i.test(status.error ?? "");
    return retryable
      ? { kind: "retry", label: "تلاش" }
      : { kind: "details", label: "بررسی", to: "/setting/sync" };
  }
  if (status.pending > 0) return { kind: "sync", label: "ارسال" };
  return null;
}

export function syncErrorMessage(error: string | null) {
  if (error?.startsWith("SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED:")) {
    return "دسترسی فعلی اجازهٔ بررسی نتیجهٔ تلاش قبلی را نمی‌دهد. این وضعیت ثابت نمی‌کند که آن تلاش بی‌اثر بوده است؛ پس از بازگشت دسترسی، نتیجه را با همان شناسه بررسی کنید.";
  }
  if (error === "PACK_SIZE_REQUIRED" || error === "PACKAGING_FLAG_INVALID") {
    return "تنظیمات بسته‌بندی یکی از محصولات کامل نیست؛ محصول را باز کنید و تعداد هر بسته را اصلاح کنید.";
  }
  if (error === "SYNC_PAUSED_FOR_RESTORE") {
    return "همگام‌سازی برای بررسی بازیابی متوقف است؛ صفحه بازیابی را باز کنید و موارد باقی‌مانده را تعیین تکلیف کنید.";
  }
  if (!error) return "نتیجه درخواست روشن نیست؛ اتصال را بررسی کنید و وضعیت را دوباره ببینید.";
  if (/network|fetch|offline|timeout/i.test(error)) return "ارتباط با سرور کامل نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";
  if (/PERMISSION|FORBIDDEN|UNAUTHORIZED|MEMBERSHIP/i.test(error)) return "این تغییر با دسترسی فعلی پذیرفته نشد؛ از مالک مجموعه بخواهید نقش و دسترسی شما را بررسی کند.";
  if (/ENTITLEMENT|CAPABILITY|PLAN_REQUIRED|CAPACITY/i.test(error)) return "طرح یا ظرفیت فعلی این تغییر را نمی‌پذیرد؛ جزئیات اشتراک را بررسی کنید.";
  if (/VERSION|CONFLICT|STALE|POLICY/i.test(error)) return "اطلاعات تازه‌تری در مجموعه ثبت شده است؛ مورد را بررسی و با نسخه تازه دوباره انجام دهید.";
  if (/UNCERTAIN|UNKNOWN|MISMATCH|FINGERPRINT/i.test(error)) return "نتیجه این درخواست قطعی نیست؛ همان کار را تکرار نکنید و جزئیات بازیابی را بررسی کنید.";
  return "این تغییر پذیرفته نشد؛ جزئیات فنی برای پیگیری نگه داشته شده است.";
}

export function syncDiagnosticCode(error: string | null) {
  return error && /^[A-Z0-9_.:-]+$/.test(error) ? error : null;
}

export function getSyncIndicator(status: SyncStatus, online: boolean): SyncIndicator {
  if (!online) {
    return {
      kind: "pending",
      label: status.pending > 0 ? `${status.pending.toLocaleString("fa-IR")} در انتظار` : "آفلاین",
      tooltip: status.pending > 0
        ? `${status.pending.toLocaleString("fa-IR")} تغییر روی این دستگاه ذخیره شده اما هنوز سرور آن را نپذیرفته است؛ پس از اتصال ارسال می‌شود.`
        : "این دستگاه آفلاین است؛ اطلاعات تازه سرور تا زمان اتصال دریافت نمی‌شود.",
    };
  }

  if (status.state === "syncing") {
    return {
      kind: "syncing",
      label: "در حال همگام‌سازی",
      tooltip: "در حال ارسال تغییرهای ثبت‌شده روی دستگاه و دریافت اطلاعات تأییدشده مجموعه است.",
    };
  }

  if (status.error === "SYNC_PAUSED_FOR_RESTORE") {
    return {
      kind: "pending",
      label: "متوقف",
      tooltip: syncErrorMessage(status.error),
    };
  }

  if (status.state === "failed" || status.state === "conflict") {
    return {
      kind: "error",
      label: status.state === "conflict" ? "نیازمند بررسی" : "خطای همگام‌سازی",
      tooltip: status.state === "conflict"
        ? "یک یا چند تغییر با نسخه سرور تداخل دارد"
        : syncErrorMessage(status.error),
    };
  }

  if (status.pending > 0) {
    return {
      kind: "pending",
      label: `${status.pending.toLocaleString("fa-IR")} در انتظار`,
      tooltip: `${status.pending.toLocaleString("fa-IR")} تغییر روی این دستگاه ذخیره شده و در انتظار پذیرش سرور است.`,
    };
  }

  if (status.state === "synced") {
    return {
      kind: "success",
      label: "همگام",
      tooltip: "همه تغییرهای عملیاتی ارسال‌شده را سرور پذیرفته است؛ پوشش تصاویر و فایل پشتیبان جداگانه نمایش داده می‌شود.",
    };
  }

  return {
    kind: "idle",
    label: "آماده",
    tooltip: "سامانه همگام‌سازی آماده است",
  };
}

export function SyncStateIcon({ kind }: Pick<SyncIndicator, "kind">) {
  if (kind === "success") return <CheckIcon width="18" height="18" />;
  if (kind === "error") return <ExclamationTriangleIcon width="18" height="18" />;
  if (kind === "pending") return <ClockIcon width="18" height="18" />;
  if (kind === "syncing") return <span className="sync-status-ring" aria-hidden="true" />;
  return <span className="sync-status-idle-dot" aria-hidden="true" />;
}

const ConnectionStatus = () => {
  const online = useOnline();
  const status = useSyncStatus();
  const indicator = getSyncIndicator(status, online);
  const compactLabel = getCompactSyncLabel(status, online);
  const action = getSyncHeaderAction(status, online);
  const [revealed, setRevealed] = useState(false);
  const [revealVersion, setRevealVersion] = useState(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusSignature = `${online}:${status.state}:${status.pending}:${status.lastSyncedAt ?? ""}:${status.error ?? ""}`;
  const previousStatusSignatureRef = useRef(statusSignature);

  const revealStatus = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealed(true);
    setRevealVersion((version) => version + 1);
    revealTimerRef.current = setTimeout(() => {
      setRevealed(false);
      revealTimerRef.current = null;
    }, STATUS_REVEAL_DURATION_MS);
  }, []);

  useEffect(() => {
    if (previousStatusSignatureRef.current === statusSignature) return;
    previousStatusSignatureRef.current = statusSignature;
    revealStatus();
  }, [revealStatus, statusSignature]);

  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
  }, []);

  useEffect(() => {
    if (status.state === "failed" && status.error) {
      notifySubscriptionRestriction(new Error(status.error));
    }
  }, [status.error, status.state]);

  const runSync = () => {
    if (!online || status.state === "syncing") return;
    revealStatus();
    void syncService.retry();
  };

  return (
    <span className="sync-status-control" data-status={indicator.kind} data-revealed={revealed}>
      <Tooltip content={indicator.tooltip}>
        <button
          type="button"
          className="sync-status-badge"
          data-status={indicator.kind}
          aria-label={`${indicator.label}؛ نمایش وضعیت همگام‌سازی`}
          aria-expanded={revealed}
          onClick={revealStatus}
        >
          <span className="sync-status-icon" aria-hidden="true">
            <SyncStateIcon kind={indicator.kind} />
          </span>
        </button>
      </Tooltip>
      <span className="sync-status-reveal" dir="rtl" aria-hidden={!revealed} aria-live="polite">
        <strong key={revealVersion} className="sync-status-label">{compactLabel}</strong>
        {revealed && action ? (
          "to" in action ? (
            <Link to={action.to} className="sync-status-action" onClick={() => setRevealed(false)} aria-label={action.kind === "recovery" ? "بررسی بازیابی" : "بررسی جزئیات همگام‌سازی"}>
              {action.kind === "recovery" ? <ArchiveIcon aria-hidden="true" /> : <MagnifyingGlassIcon aria-hidden="true" />}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button type="button" className="sync-status-action" onClick={runSync} aria-label={action.kind === "sync" ? "همگام‌سازی اکنون" : "تلاش دوباره"}>
              <ReloadIcon aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          )
        ) : null}
      </span>
    </span>
  );
};

export default ConnectionStatus;
