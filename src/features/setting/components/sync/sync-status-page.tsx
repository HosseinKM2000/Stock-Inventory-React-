import { getSyncIndicator, SyncStateIcon, syncErrorMessage } from "@/features/app/layout/connection-status";
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

  const runSync = () => {
    if (!online || status.state === "syncing" || paused) return;
    void syncService.retry();
  };

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
        </Callout.Root>
      )}

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
                        شناسه {item.entityId.toLocaleString("fa-IR")} · {formatTime(item.updatedAt)}
                      </Text>
                      {item.lastError && <Text as="div" size="1" color="red" mt="1">{item.lastError}</Text>}
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
