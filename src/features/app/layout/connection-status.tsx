import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import {
  useOnline,
  useSyncStatus,
} from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Badge, Tooltip } from "@radix-ui/themes";

type Indicator = {
  label: string;
  color: "gray" | "green" | "amber" | "red" | "blue";
  tooltip: string;
};

function syncErrorMessage(error: string | null) {
  if (error === "PACK_SIZE_REQUIRED" || error === "PACKAGING_FLAG_INVALID") {
    return "تنظیمات بسته‌بندی یکی از محصولات نامعتبر است";
  }
  return error ?? "برای تلاش مجدد کلیک کنید";
}

const ConnectionStatus = () => {
  const online = useOnline();

  const status = useSyncStatus();

  const indicator = ((): Indicator => {
    if (!online) {
      return {
        label: "آفلاین",
        color: "amber",
        tooltip: status.pending
          ? `${status.pending} تغییر در انتظار همگام سازی`
          : "تغییرات به صورت محلی ذخیره می شوند",
      };
    }

    if (status.state === "syncing") {
      return {
        label: "در حال همگام سازی",
        color: "blue",
        tooltip: "ارسال تغییرات محلی به سرور",
      };
    }

    if (status.state === "failed") {
      return {
        label: "خطای همگام سازی",
        color: "red",
        tooltip: syncErrorMessage(status.error),
      };
    }

    if (status.pending > 0) {
      return {
        label: "در انتظار همگام سازی",
        color: "amber",
        tooltip: `${status.pending} تغییر در انتظار ارسال`,
      };
    }

    return {
      label: status.state === "synced" ? "همگام" : "آنلاین",
      color: "green",
      tooltip: "همه تغییرات ذخیره شده اند",
    };
  })();

  const retryable = online && (status.state === "failed" || status.pending > 0);

  return (
    <Tooltip content={indicator.tooltip}>
      <Badge
        color={indicator.color}
        variant="soft"
        radius="full"
        className={retryable ? "cursor-pointer" : undefined}
        onClick={() => retryable && void syncService.retry()}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          aria-hidden
        />
        {indicator.label}
      </Badge>
    </Tooltip>
  );
};

export default ConnectionStatus;
