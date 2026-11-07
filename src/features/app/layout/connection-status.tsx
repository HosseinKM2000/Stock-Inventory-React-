import { notifySubscriptionRestriction } from "@/shared/access/subscription-limit";
import type { SyncStatus } from "@/shared/lib/infrastructure/sync/sync-status";
import {
  useOnline,
  useSyncStatus,
} from "@/shared/lib/infrastructure/sync/use-sync-status";
import { CheckIcon, ClockIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Tooltip } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

export type SyncIndicator = {
  kind: "idle" | "pending" | "syncing" | "success" | "error";
  label: string;
  tooltip: string;
};

export function syncErrorMessage(error: string | null) {
  if (error === "PACK_SIZE_REQUIRED" || error === "PACKAGING_FLAG_INVALID") {
    return "تنظیمات بسته‌بندی یکی از محصولات نامعتبر است";
  }
  if (error === "SYNC_PAUSED_FOR_RESTORE") {
    return "همگام‌سازی پس از بازیابی فایل پشتیبان متوقف شده است";
  }
  return error ?? "جزئیات خطا ثبت نشده است";
}

export function getSyncIndicator(status: SyncStatus, online: boolean): SyncIndicator {
  if (!online) {
    return {
      kind: "pending",
      label: status.pending > 0 ? `${status.pending.toLocaleString("fa-IR")} در انتظار` : "آفلاین",
      tooltip: status.pending > 0
        ? `${status.pending.toLocaleString("fa-IR")} تغییر پس از اتصال ارسال می‌شود`
        : "تغییرات به‌صورت محلی ذخیره می‌شوند",
    };
  }

  if (status.state === "syncing") {
    return {
      kind: "syncing",
      label: "در حال همگام‌سازی",
      tooltip: "در حال ارسال تغییرات محلی و دریافت نسخه سرور",
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
      tooltip: `${status.pending.toLocaleString("fa-IR")} تغییر در صف ارسال است`,
    };
  }

  if (status.state === "synced") {
    return {
      kind: "success",
      label: "همگام",
      tooltip: "همه تغییرات با سرور همگام شده‌اند",
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

  useEffect(() => {
    if (status.state === "failed" && status.error) {
      notifySubscriptionRestriction(new Error(status.error));
    }
  }, [status.error, status.state]);

  return (
    <Tooltip content={indicator.tooltip}>
      <Link
        to="/setting/sync"
        className="sync-status-badge"
        data-status={indicator.kind}
        aria-label={`${indicator.label}؛ مشاهده جزئیات همگام‌سازی`}
      >
        <span className="sync-status-icon" aria-hidden="true">
          <SyncStateIcon kind={indicator.kind} />
        </span>
      </Link>
    </Tooltip>
  );
};

export default ConnectionStatus;
