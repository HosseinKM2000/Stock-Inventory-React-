import { getSyncIndicator, SyncStateIcon, syncDiagnosticCode, syncErrorMessage } from "@/features/app/layout/connection-status";
import { Button } from "@/shared/ui/button/button";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import {
  useOnline,
  useSyncEvents,
  useSyncStatus,
} from "@/shared/lib/infrastructure/sync/use-sync-status";
import { CheckIcon, ClockIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Badge, Box, Callout, Flex, Grid, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { PageGuide } from "@/features/app/layout/page-guide";
import { mediaRecoveryService, type MediaRecoverySummary } from "@/shared/lib/infrastructure/media/media-recovery.service";
import { mediaTransferService } from "@/shared/lib/infrastructure/media/media-transfer.service";
import { accessState } from "@/shared/access/access-state";
import { toast } from "sonner";

const dateFormatter = { format: formatJalaliDateTime };

const entityLabels: Record<string, string> = {
  product: "محصول",
  category: "دسته‌بندی",
  label: "برچسب",
};

const actionLabels: Record<SyncQueueItem["action"], string> = {
  CREATE: "ایجاد",
  UPDATE: "ویرایش",
  DELETE: "حذف",
};

const queueStatusLabels: Record<SyncQueueItem["status"], string> = {
  pending: "در انتظار",
  in_flight: "در حال ارسال",
  retryable_error: "تلاش دوباره",
  conflict: "تداخل",
  fatal_error: "خطای قطعی",
  dead_letter: "متوقف‌شده",
};

function formatTime(value: number | null) {
  return value ? dateFormatter.format(value) : "هنوز انجام نشده";
}

export function SyncStatusPage() {
  const online = useOnline();
  const status = useSyncStatus();
  const events = useSyncEvents();
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [mediaSummary, setMediaSummary] = useState<MediaRecoverySummary | null>(null);
  const [mediaPending, setMediaPending] = useState(0);
  const [mediaWorking, setMediaWorking] = useState(false);
  const [mediaProgress, setMediaProgress] = useState<string | null>(null);
  const indicator = getSyncIndicator(status, online);
  const paused = syncService.isPaused();

  useEffect(() => {
    let current = true;
    void queueService.getAll()
      .then((items) => {
        if (current) {
          setQueue(items.toSorted((a, b) => b.updatedAt - a.updatedAt));
          setQueueError(null);
        }
      })
      .catch(() => {
        if (current) setQueueError("نمایش کارهای در انتظار ممکن نشد. صفحه را دوباره باز کنید.");
      })
      .finally(() => {
        if (current) setQueueLoading(false);
      });
    return () => { current = false; };
  }, [status.error, status.lastSyncedAt, status.pending, status.state]);

  useEffect(() => {
    let current = true;
    void Promise.all([mediaRecoveryService.summary(), mediaTransferService.summary()]).then(([summary, transfers]) => {
      if (!current) return;
      setMediaSummary(summary);
      setMediaPending(transfers.filter((item) => item.status !== "uploaded").length);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [status.lastSyncedAt, status.pending, status.state]);

  const runSync = () => {
    if (!online || status.state === "syncing" || paused) return;
    void syncService.retry();
  };

  const recoverMedia = async () => {
    if (mediaWorking || !online) return;
    setMediaWorking(true);
    setMediaProgress(null);
    try {
      await mediaTransferService.retryFailures();
      const result = await mediaRecoveryService.downloadForOffline((done, total) => {
        setMediaProgress(`${done.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")}`);
      });
      setMediaSummary(await mediaRecoveryService.summary());
      setMediaPending((await mediaTransferService.summary()).filter((item) => item.status !== "uploaded").length);
      toast.success(result.total ? "تصاویر قابل بازیابی روی این دستگاه ذخیره شدند" : "همهٔ تصاویر در دسترس آفلاین هستند");
    } catch (error) {
      toast.error(error instanceof Error && error.name === "QuotaExceededError"
        ? "فضای ذخیره‌سازی دستگاه برای دریافت تصاویر کافی نیست"
        : "دریافت تصاویر کامل نشد؛ وضعیت اتصال و فضای دستگاه را بررسی کنید");
    } finally {
      setMediaWorking(false);
    }
  };

  const canRecoverMedia = accessState.canUse("backup") && accessState.hasStorePermission("tools.backup");
  const mediaCoverageColor = (mediaSummary?.missing ?? 0) > 0 ? "amber" : "green";
  const mediaCoverageLabel = `${(mediaSummary?.localAvailable ?? 0).toLocaleString("fa-IR")} محلی از ${(mediaSummary?.serverAvailable ?? 0).toLocaleString("fa-IR")}`;

  return (
    <Box dir="rtl" className="sync-detail-page mx-auto w-full max-w-5xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="همگام‌سازی" description="اینجا ببینید تغییرها ثبت شده‌اند یا به اتصال و بررسی شما نیاز دارند." icon={ReloadIcon} helpTopic="sync" />

      <section className="sync-overview" aria-labelledby="sync-current-title">
        <Flex align="center" justify="between" gap="4" wrap="wrap">
          <Flex align="center" gap="3">
            <span className="sync-overview-icon" data-status={indicator.kind} aria-hidden="true">
              <SyncStateIcon kind={indicator.kind} />
            </span>
            <Box>
              <h2 id="sync-current-title" className="text-xl font-bold">{indicator.label}</h2>
              <Text as="p" size="2" color="gray" mt="1">{indicator.tooltip}</Text>
            </Box>
          </Flex>
          <Button
            type="button"
            onClick={runSync}
            disabled={!online || paused}
            loading={status.state === "syncing"}
          >
            <ReloadIcon /> همگام‌سازی اکنون
          </Button>
        </Flex>

        <Grid columns={{ initial: "2", md: "4" }} gap="4" mt="6" className="sync-facts">
          <Box><Text size="1" color="gray">اتصال</Text><Text as="div" weight="bold" mt="1">{online ? "آنلاین" : "آفلاین"}</Text></Box>
          <Box><Text size="1" color="gray">در انتظار</Text><Text as="div" weight="bold" mt="1">{status.pending.toLocaleString("fa-IR")} تغییر</Text></Box>
          <Box><Text size="1" color="gray">آخرین همگام‌سازی</Text><Text as="div" weight="bold" mt="1">{formatTime(status.lastSyncedAt)}</Text></Box>
          <Box><Text size="1" color="gray">پیگیری خودکار</Text><Text as="div" weight="bold" mt="1">{paused ? "متوقف" : "فعال"}</Text></Box>
        </Grid>
      </section>

      {status.error && (
        <Callout.Root color="red" mt="5" role="alert">
          <Callout.Text>{syncErrorMessage(status.error)}</Callout.Text>
          {syncDiagnosticCode(status.error) ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{syncDiagnosticCode(status.error)}</code></details> : null}
        </Callout.Root>
      )}

      <section className="sync-detail-section mt-5" aria-labelledby="offline-media-title">
        <Flex align="center" justify="between" gap="4" wrap="wrap">
          <Box className="min-w-0 flex-1">
            <h2 id="offline-media-title" className="text-lg font-bold">تصاویر آفلاین</h2>
            <Text as="p" size="2" color="gray" mt="1">
              متادیتای محصول مستقل از فایل تصویر همگام می‌شود. برای استفاده بدون اینترنت، بایت‌های موجود سرور را روی همین دستگاه دریافت کنید.
            </Text>
            <Flex gap="2" wrap="wrap" mt="3">
              <Badge color={mediaCoverageColor}>{mediaCoverageLabel}</Badge>
              {mediaPending > 0 ? <Badge color="amber">{mediaPending.toLocaleString("fa-IR")} انتقال نیازمند پیگیری</Badge> : null}
              {mediaProgress ? <Badge color="blue">{mediaProgress}</Badge> : null}
            </Flex>
          </Box>
          {canRecoverMedia ? (
            <Button type="button" onClick={() => void recoverMedia()} disabled={!online} loading={mediaWorking} className="w-full sm:w-auto">
              دریافت تصاویر برای استفاده آفلاین
            </Button>
          ) : (
            <Text size="1" color="gray">این اقدام به دسترسی پشتیبان‌گیری مجموعه نیاز دارد.</Text>
          )}
        </Flex>
      </section>

      <Grid columns={{ initial: "1", lg: "2" }} gap="5" mt="5">
        <section className="sync-detail-section" aria-labelledby="sync-queue-title">
          <Flex align="center" justify="between" gap="3" mb="4">
            <Box>
              <h2 id="sync-queue-title" className="text-lg font-bold">کارهای در انتظار</h2>
              <Text as="p" size="1" color="gray" mt="1">تغییرهایی که هنوز نتیجه نهایی آن‌ها مشخص نشده است</Text>
            </Box>
            <Badge color={queue.length > 0 ? "amber" : "green"} radius="full">
              {queue.length.toLocaleString("fa-IR")}
            </Badge>
          </Flex>

          {queueError ? (
            <Callout.Root color="red"><Callout.Text>{queueError}</Callout.Text></Callout.Root>
          ) : queueLoading ? (
            <Text color="gray">در حال بررسی…</Text>
          ) : queue.length === 0 ? (
            <Flex align="center" gap="2" className="sync-empty-state">
              <CheckIcon aria-hidden="true" />
              <Text size="2">تغییر منتظری وجود ندارد.</Text>
            </Flex>
          ) : (
            <ol className="sync-queue-list">
              {queue.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <Flex justify="between" gap="3" align="start">
                    <Box>
                      <Text as="div" size="2" weight="bold">
                        {actionLabels[item.action]} {entityLabels[item.entity] ?? item.entity}
                      </Text>
                      <Text as="div" size="1" color="gray" mt="1">
                        {formatTime(item.updatedAt)}
                      </Text>
                      {item.lastError && <><Text as="div" size="1" color="red" mt="1">{syncErrorMessage(item.lastError)}</Text>{syncDiagnosticCode(item.lastError) ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{syncDiagnosticCode(item.lastError)}</code></details> : null}</>}
                    </Box>
                    <Badge color={item.status === "conflict" || item.status === "fatal_error" || item.status === "dead_letter" ? "red" : item.status === "in_flight" ? "blue" : "amber"}>
                      {queueStatusLabels[item.status]}
                    </Badge>
                  </Flex>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="sync-detail-section" aria-labelledby="sync-events-title">
          <Box mb="4">
            <h2 id="sync-events-title" className="text-lg font-bold">گزارش وضعیت اخیر</h2>
            <Text as="p" size="1" color="gray" mt="1">آخرین نتیجه‌هایی که برای پیگیری شما نمایش داده شده‌اند</Text>
          </Box>
          {events.length === 0 ? (
            <Flex align="center" gap="2" className="sync-empty-state">
              <ClockIcon aria-hidden="true" />
              <Text size="2">هنوز رخدادی در این اجرا ثبت نشده است.</Text>
            </Flex>
          ) : (
            <ol className="sync-event-list">
              {events.slice(0, 10).map((event) => {
                const eventIndicator = getSyncIndicator(event, online);
                return (
                  <li key={event.id}>
                    <span className="sync-event-marker" data-status={eventIndicator.kind} aria-hidden="true">
                      <SyncStateIcon kind={eventIndicator.kind} />
                    </span>
                    <Box>
                      <Text as="div" size="2" weight="bold">{eventIndicator.label}</Text>
                      <Text as="div" size="1" color="gray" mt="1">{formatTime(event.occurredAt)}</Text>
                      {event.error && <Text as="div" size="1" color="red" mt="1">{syncErrorMessage(event.error)}</Text>}
                    </Box>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </Grid>

      <section className="sync-flow" aria-labelledby="sync-flow-title">
        <h2 id="sync-flow-title" className="text-lg font-bold">چه زمانی این صفحه را بررسی کنید؟</h2>
        <ol>
          <li><span>۱</span><div><strong>بعد از تغییرهای زیاد</strong><small>پس از ورود گروهی یا ویرایش چند محصول، نتیجه را اینجا بررسی کنید.</small></div></li>
          <li><span>۲</span><div><strong>پیش از خروج یا پاک‌سازی مرورگر</strong><small>مطمئن شوید کاری در انتظار نمانده است.</small></div></li>
          <li><span>۳</span><div><strong>وقتی وضعیت «در انتظار» است</strong><small>اتصال اینترنت را بررسی کنید و «همگام‌سازی اکنون» را بزنید.</small></div></li>
          <li><span>۴</span><div><strong>وقتی خطا می‌بینید</strong><small>راهنمای همان پیام را دنبال کنید و عملیات را چندبار تکرار نکنید.</small></div></li>
        </ol>
      </section>
    </Box>
  );
}
