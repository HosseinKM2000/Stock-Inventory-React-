import { PageGuide } from "@/features/app/layout/page-guide";
import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { Button } from "@/shared/ui/button/button";
import {
  CheckCircledIcon,
  DownloadIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Flex, Grid, Separator, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useAppUpdate } from "../hooks/use-app-update";
import { appUpdateService } from "../services/app-update.service";

const persianVersion = (value: string) => value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);

export function AppUpdatePage() {
  const update = useAppUpdate();
  const access = useEntitlementAccess();
  const isChecking = update.status === "checking";
  const isApplying = update.status === "applying";
  const ready = ["ready", "deferred", "applying"].includes(update.status);
  const failed = update.status === "failed";

  const statusTitle =
    update.status === "checking" ? "در حال بررسی و آماده‌سازی نسخه جدید"
      : update.status === "ready" ? "نسخه جدید آماده نصب است"
        : update.status === "deferred" ? "نصب تا رفع مانع به تعویق افتاده است"
          : update.status === "applying" ? "در حال فعال‌سازی نسخه جدید"
            : failed ? "بروزرسانی کامل نشد"
              : update.status === "current" ? "برنامه بروز است"
                : "بررسی بروزرسانی";

  const install = () => {
    void appUpdateService.activateUpdate();
  };

  return (
    <Box dir="rtl" className="app-update-page">
      <PageGuide
        section="تنظیمات"
        sectionTo="/setting"
        title="بروزرسانی برنامه"
        description="نسخه تازه تنظیم را بررسی و پس از آماده‌شدن کامل، بدون آسیب به اطلاعات محلی نصب کنید."
        icon={DownloadIcon}
        helpTopic="account"
      />

      <Card mt="5" size="3" className="app-update-hero">
        <Flex justify="between" align="center" gap="4" wrap="wrap">
          <Flex align="center" gap="3" className="min-w-0">
            <span className="app-update-hero-icon" aria-hidden="true"><DownloadIcon width="26" height="26" /></span>
            <Box className="min-w-0">
              <Text as="div" size="1" color="gray">وضعیت برنامه روی این دستگاه</Text>
              <Text as="div" size="5" weight="bold" mt="1">
                {statusTitle}
              </Text>
            </Box>
          </Flex>
          <Badge size="2" radius="full" color={failed ? "red" : update.status === "deferred" ? "amber" : ready ? "violet" : "green"} variant="soft">
            {isApplying ? "در حال اعمال" : update.status === "deferred" ? "به تعویق افتاده" : update.status === "ready" ? "آماده نصب" : failed ? "ناموفق" : "نسخه فعال"}
          </Badge>
        </Flex>

        <Grid columns={{ initial: "1", sm: "2" }} gap="3" mt="5">
          <Box className="app-update-version-card">
            <Text as="div" size="1" color="gray">نسخه نصب‌شده</Text>
            <Text as="div" size="4" weight="bold" mt="1">{persianVersion(update.currentVersion)}</Text>
          </Box>
          <Box className="app-update-version-card">
            <Text as="div" size="1" color="gray">آخرین نسخه منتشرشده</Text>
            <Text as="div" size="4" weight="bold" mt="1">
              {update.release ? persianVersion(update.release.version) : "در انتظار بررسی"}
            </Text>
          </Box>
        </Grid>

        {update.error ? (
          <Callout.Root color={update.status === "deferred" ? "amber" : "red"} mt="4"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text>{update.error}</Callout.Text></Callout.Root>
        ) : null}

        <Flex gap="3" mt="5" wrap="wrap">
          {ready ? (
            <Button size="3" onClick={install} loading={isApplying} disabled={!update.canInstall || isApplying} leftIcon={<DownloadIcon />}>
              {isApplying ? "در حال فعال‌سازی…" : update.status === "deferred" ? "تلاش دوباره برای نصب" : "نصب نسخه جدید"}
            </Button>
          ) : null}
          <Button size="3" variant={ready ? "soft" : "solid"} onClick={() => void appUpdateService.checkForUpdate()} loading={isChecking} leftIcon={<ReloadIcon />}>
            بررسی دوباره
          </Button>
        </Flex>
        <Text as="div" size="1" color="gray" mt="3">
          {update.lastCheckedAt ? `آخرین بررسی: ${formatJalaliDateTime(update.lastCheckedAt)}` : "هنوز بررسی آنلاین انجام نشده است."}
        </Text>
      </Card>

      {update.release ? (
        <Card mt="4" size="3" className="app-update-release-card">
          <Text as="div" size="4" weight="bold">{update.release.title}</Text>
          <Text as="p" size="2" color="gray" mt="2" className="leading-7">{update.release.summary}</Text>
          <Text as="div" size="1" color="gray" mt="2">تاریخ انتشار: {formatJalaliDateTime(update.release.released_at)}</Text>
          <Separator size="4" my="4" />
          <Flex direction="column" gap="3">
            {update.release.features.map((feature) => {
              const included = !feature.capability || accessState.canUse(feature.capability);
              return (
                <Flex key={feature.title} gap="3" align="start" className="app-update-feature">
                  <span className="app-update-feature-icon" data-included={included} aria-hidden="true">
                    {included ? <CheckCircledIcon /> : <LockClosedIcon />}
                  </span>
                  <Box className="min-w-0 flex-1">
                    <Flex justify="between" gap="2" wrap="wrap">
                      <Text size="2" weight="bold">{feature.title}</Text>
                      <Badge color={included ? "green" : "amber"} variant="soft" radius="full">
                        {included ? "فعال در طرح شما" : "نیازمند طرح بالاتر"}
                      </Badge>
                    </Flex>
                    <Text as="div" size="2" color="gray" mt="1">{feature.description}</Text>
                  </Box>
                </Flex>
              );
            })}
          </Flex>
          {access.requiresOnlineVerification ? (
            <Callout.Root color="blue" mt="4"><Callout.Text>نمایش دسترسی‌ها بر اساس آخرین وضعیت تأییدشده است؛ برای تأیید تازه به اینترنت متصل بمانید.</Callout.Text></Callout.Root>
          ) : null}
          <Text as="div" size="1" color="gray" mt="4">
            نصب نسخه برنامه رایگان است؛ استفاده از قابلیت‌های اشتراکی همچنان بر اساس طرح تأییدشده مجموعه انجام می‌شود. <Link to="/setting/subscription" className="app-inline-link">مشاهده اشتراک</Link>
          </Text>
        </Card>
      ) : null}
    </Box>
  );
}
