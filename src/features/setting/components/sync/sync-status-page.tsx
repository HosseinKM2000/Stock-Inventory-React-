import { getSyncIndicator, SyncStateIcon, syncDiagnosticCode, syncErrorMessage } from "@/features/app/layout/connection-status";
import { Button } from "@/shared/ui/button/button";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { isAccessDeniedOutcomeUnresolved, queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import {
  useOnline,
  useSyncEvents,
  useSyncStatus,
} from "@/shared/lib/infrastructure/sync/use-sync-status";
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  CounterClockwiseClockIcon,
  GearIcon,
  GlobeIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  MobileIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Callout, Flex, Grid, Text } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { PageGuide } from "@/features/app/layout/page-guide";
import { mediaRecoveryService, type MediaRecoverySummary } from "@/shared/lib/infrastructure/media/media-recovery.service";
import { mediaTransferService } from "@/shared/lib/infrastructure/media/media-transfer.service";
import { accessState } from "@/shared/access/access-state";
import { toast } from "sonner";
import { problemReportText } from "@/shared/lib/diagnostics/diagnostic-buffer";

const dateFormatter = { format: formatJalaliDateTime };

const entityLabels: Record<string, string> = {
  product: "محصول",
  category: "دسته‌بندی",
  label: "برچسب",
  barcode: "بارکد",
  inventory_movement: "تغییر موجودی",
  invoice: "فاکتور",
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

type QueueFilter = "all" | "pending" | "sending" | "error";

const queueFilters: Array<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "همه" },
  { value: "pending", label: "در انتظار" },
  { value: "sending", label: "در حال ارسال" },
  { value: "error", label: "نیازمند بررسی" },
];

function queueFilterFor(item: SyncQueueItem): Exclude<QueueFilter, "all"> {
  if (item.status === "in_flight") return "sending";
  if (item.status === "conflict" || item.status === "fatal_error" || item.status === "dead_letter" || isAccessDeniedOutcomeUnresolved(item)) return "error";
  return "pending";
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
  const [resolvingOperationId, setResolvingOperationId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");
  const indicator = getSyncIndicator(status, online);
  const paused = syncService.isPaused();

  const queueCounts = useMemo(() => queue.reduce((counts, item) => {
    counts[queueFilterFor(item)] += 1;
    return counts;
  }, { pending: 0, sending: 0, error: 0 }), [queue]);

  const visibleQueue = useMemo(() => {
    const query = queueSearch.trim().toLocaleLowerCase("fa");
    return queue.filter((item) => {
      if (queueFilter !== "all" && queueFilterFor(item) !== queueFilter) return false;
      if (!query) return true;
      const searchable = `${actionLabels[item.action]} ${entityLabels[item.entity] ?? item.entity} ${queueStatusLabels[item.status]} ${item.operationId}`;
      return searchable.toLocaleLowerCase("fa").includes(query);
    });
  }, [queue, queueFilter, queueSearch]);

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

  const resolveAccessDeniedOutcome = async (item: SyncQueueItem) => {
    if (!online || resolvingOperationId) return;
    setResolvingOperationId(item.operationId);
    try {
      const result = await syncService.resolveAccessDeniedOutcome(item);
      toast.success(result === "applied"
        ? "نتیجهٔ ثبت‌شده پیدا شد و اثر دوباره اجرا نشد"
        : result === "not_recorded"
          ? "سرور نتیجه‌ای برای این شناسه ثبت نکرده است"
          : "نتیجهٔ ثبت‌شده دریافت شد");
    } catch (error) {
      toast.error(syncErrorMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      setResolvingOperationId(null);
    }
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
  const supportReport = () => problemReportText({
    sync_state: status.state,
    pending_count: status.pending,
    queue: queue.slice(0, 20).map((item) => ({
      operation_id: item.operationId,
      entity: item.entity,
      action: item.action,
      status: item.status,
      attempt_state: item.attemptState,
      retry_count: item.retryCount,
    })),
    media: {
      pending_count: mediaPending,
      local_available: mediaSummary?.localAvailable ?? null,
      server_available: mediaSummary?.serverAvailable ?? null,
      missing_count: mediaSummary?.missing ?? null,
    },
  });

  const copySupportReport = async () => {
    try {
      await navigator.clipboard.writeText(supportReport());
      toast.success("گزارش امن برای پشتیبانی کپی شد");
    } catch {
      toast.error("کپی گزارش ممکن نشد؛ فایل گزارش را دریافت کنید");
    }
  };

  const downloadSupportReport = () => {
    const url = URL.createObjectURL(new Blob([supportReport()], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tanzim-problem-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const mediaCoverageColor = (mediaSummary?.missing ?? 0) > 0 ? "amber" : "green";
  const mediaCoverageLabel = `${(mediaSummary?.localAvailable ?? 0).toLocaleString("fa-IR")} محلی از ${(mediaSummary?.serverAvailable ?? 0).toLocaleString("fa-IR")}`;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Box dir="rtl" className="sync-detail-page mx-auto w-full max-w-6xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="همگام‌سازی و بک‌لاگ" description="وضعیت ارسال تغییرها، صف عملیات و دسترسی آفلاین این دستگاه را یکجا ببینید." icon={ReloadIcon} helpTopic="sync" />

      <section className="sync-overview sync-control-hero" data-status={indicator.kind} aria-labelledby="sync-current-title">
        <div className="sync-control-hero-main">
          <Flex align="center" gap="3" className="sync-control-summary">
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
            className="sync-primary-action"
          >
            <ReloadIcon /> همگام‌سازی اکنون
          </Button>
        </div>

        <Grid columns={{ initial: "2", md: "4" }} gap="4" className="sync-facts">
          <Box><GlobeIcon aria-hidden="true" /><span><Text size="1" color="gray">اتصال</Text><Text as="div" weight="bold" mt="1">{online ? "آنلاین" : "آفلاین"}</Text></span></Box>
          <Box><MobileIcon aria-hidden="true" /><span><Text size="1" color="gray">این دستگاه</Text><Text as="div" weight="bold" mt="1">فعال</Text></span></Box>
          <Box><ArchiveIcon aria-hidden="true" /><span><Text size="1" color="gray">در انتظار</Text><Text as="div" weight="bold" mt="1">{status.pending.toLocaleString("fa-IR")} تغییر</Text></span></Box>
          <Box><Text size="1" color="gray">آخرین همگام‌سازی</Text><Text as="div" weight="bold" mt="1">{formatTime(status.lastSyncedAt)}</Text></Box>
        </Grid>
      </section>

      {status.error && (
        <Callout.Root color="red" mt="5" role="alert">
          <Callout.Text>{syncErrorMessage(status.error)}</Callout.Text>
          {syncDiagnosticCode(status.error) ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{syncDiagnosticCode(status.error)}</code></details> : null}
        </Callout.Root>
      )}

      <div className="sync-action-grid" aria-label="اقدام‌های همگام‌سازی">
        <button type="button" className="sync-action-tile sync-action-tile-primary" aria-label="همگام‌سازی تغییرهای منتظر" onClick={runSync} disabled={!online || paused || status.state === "syncing"}>
          <ReloadIcon aria-hidden="true" />
          <span><strong>همگام‌سازی اکنون</strong><small>{status.pending ? `${status.pending.toLocaleString("fa-IR")} تغییر آماده ارسال` : "دریافت و ارسال تازه‌ترین تغییرها"}</small></span>
        </button>
        <button type="button" className="sync-action-tile" onClick={() => scrollTo("sync-backlog")}>
          <CounterClockwiseClockIcon aria-hidden="true" />
          <span><strong>تاریخچه و بک‌لاگ</strong><small>بررسی نتیجه عملیات اخیر</small></span>
        </button>
        <button type="button" className="sync-action-tile" onClick={() => scrollTo("offline-media-title")}>
          <ImageIcon aria-hidden="true" />
          <span><strong>دسترسی آفلاین</strong><small>تصاویر ذخیره‌شده روی دستگاه</small></span>
        </button>
        <Link to="/setting/backup" className="sync-action-tile">
          <GearIcon aria-hidden="true" />
          <span><strong>پشتیبان‌گیری</strong><small>تنظیم فایل و بازیابی اطلاعات</small></span>
        </Link>
      </div>

      <div className="sync-workspace-grid mt-5">
        <section id="sync-backlog" className="sync-detail-section sync-backlog-panel" aria-labelledby="sync-queue-title">
          <div className="sync-section-heading">
            <Box>
              <h2 id="sync-queue-title" className="text-lg font-bold">کارهای در انتظار</h2>
              <Text as="p" size="2" color="gray" mt="1">عملیات این دستگاه تا دریافت نتیجه قطعی در این فهرست می‌مانند.</Text>
            </Box>
            <Badge color={queue.length > 0 ? "amber" : "green"} radius="full">{queue.length.toLocaleString("fa-IR")}</Badge>
          </div>

          <div className="sync-queue-toolbar">
            <label className="sync-search-field">
              <MagnifyingGlassIcon aria-hidden="true" />
              <span className="sr-only">جست‌وجوی عملیات</span>
              <input value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="جست‌وجوی عملیات…" />
            </label>
            <div className="sync-filter-list" role="group" aria-label="فیلتر وضعیت عملیات">
              {queueFilters.map((filter) => {
                const count = filter.value === "all" ? queue.length : queueCounts[filter.value];
                return (
                  <button key={filter.value} type="button" data-active={queueFilter === filter.value} onClick={() => setQueueFilter(filter.value)}>
                    {filter.label}<span>{count.toLocaleString("fa-IR")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {queueError ? (
            <Callout.Root color="red"><Callout.Text>{queueError}</Callout.Text></Callout.Root>
          ) : queueLoading ? (
            <Text color="gray">در حال بررسی…</Text>
          ) : visibleQueue.length === 0 ? (
            <Flex align="center" gap="2" className="sync-empty-state">
              <CheckIcon aria-hidden="true" />
              <Text size="2">{queue.length ? "عملیاتی با این فیلتر پیدا نشد." : "تغییر منتظری وجود ندارد."}</Text>
            </Flex>
          ) : (
            <ol className="sync-queue-list">
              {visibleQueue.slice(0, 20).map((item) => (
                <li key={item.id} data-state={queueFilterFor(item)}>
                  <span className="sync-operation-icon" aria-hidden="true"><ArchiveIcon /></span>
                  <Box className="sync-operation-copy">
                    <Text as="div" size="2" weight="bold">{actionLabels[item.action]} {entityLabels[item.entity] ?? item.entity}</Text>
                    <Text as="div" size="1" color="gray" mt="1">{formatTime(item.updatedAt)}</Text>
                    {item.lastError && <><Text as="div" size="1" color="red" mt="1">{syncErrorMessage(item.lastError)}</Text>{syncDiagnosticCode(item.lastError) ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{syncDiagnosticCode(item.lastError)}</code></details> : null}</>}
                    {isAccessDeniedOutcomeUnresolved(item) ? (
                      <Button type="button" mt="2" variant="soft" disabled={!online} loading={resolvingOperationId === item.operationId} onClick={() => void resolveAccessDeniedOutcome(item)}>
                        بررسی نتیجه با همان شناسه
                      </Button>
                    ) : null}
                  </Box>
                  <Badge className="sync-operation-status" color={isAccessDeniedOutcomeUnresolved(item) ? "amber" : item.status === "conflict" || item.status === "fatal_error" || item.status === "dead_letter" ? "red" : item.status === "in_flight" ? "blue" : "amber"}>
                    {isAccessDeniedOutcomeUnresolved(item) ? "نتیجه نامشخص" : queueStatusLabels[item.status]}
                  </Badge>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="sync-detail-section sync-events-panel" aria-labelledby="sync-events-title">
          <Box mb="4">
            <h2 id="sync-events-title" className="text-lg font-bold">گزارش وضعیت اخیر</h2>
            <Text as="p" size="1" color="gray" mt="1">آخرین نتیجه‌های ثبت‌شده در این اجرا</Text>
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
                    <span className="sync-event-marker" data-status={eventIndicator.kind} aria-hidden="true"><SyncStateIcon kind={eventIndicator.kind} /></span>
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
      </div>

      <Grid columns={{ initial: "1", lg: "2" }} gap="5" mt="5">
      <section className="sync-detail-section sync-media-panel" aria-labelledby="offline-media-title">
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
      <section className="sync-detail-section sync-support-panel" aria-labelledby="support-report-title">
        <Flex align="center" justify="between" gap="4" wrap="wrap">
          <Box className="min-w-0 flex-1">
            <h2 id="support-report-title" className="text-lg font-bold">گزارش امن برای پشتیبانی</h2>
            <Text as="p" size="2" color="gray" mt="1">
              این گزارش فقط وضعیت فنی، شناسه‌های پیگیری و نسخه‌ها را نگه می‌دارد؛ رمز، توکن، متن کالا، تصویر و شناسه حساب در آن قرار نمی‌گیرد.
            </Text>
          </Box>
          <Flex gap="2" wrap="wrap" className="w-full sm:w-auto">
            <Button type="button" variant="soft" onClick={() => void copySupportReport()} className="flex-1 sm:flex-none">کپی گزارش</Button>
            <Button type="button" variant="soft" onClick={downloadSupportReport} className="flex-1 sm:flex-none">دریافت فایل گزارش</Button>
          </Flex>
        </Flex>
      </section>
      </Grid>

      <section className="sync-flow" aria-labelledby="sync-flow-title">
        <span className="sync-flow-icon" aria-hidden="true"><ReloadIcon /></span>
        <div><h2 id="sync-flow-title" className="text-lg font-bold">همگام‌سازی چطور کار می‌کند؟</h2><p>تغییرهای شما ابتدا امن روی این دستگاه ثبت می‌شوند و پس از اتصال، با حساب مجموعه همگام می‌شوند. پیش از خروج یا پاک‌سازی مرورگر، بک‌لاگ را بررسی کنید.</p></div>
      </section>
    </Box>
  );
}
