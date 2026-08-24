import { useEntitlement } from "@/shared/access/use-entitlement";
import { isAdmin } from "@/shared/access/authorization";
import { useAuth } from "@/shared/auth/use-auth";
import { CheckCircledIcon, ClockIcon, ExclamationTriangleIcon, StarIcon } from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Flex, Grid, Separator, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useAvailablePlans } from "../../mutations/use-admin";
import { FEATURE_LABELS, formatToman } from "../subscription-management/plan-options";

const date = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "—";

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" | "violet" }) {
  return <Card><Text as="div" size="1" color="gray">{label}</Text><Text as="div" size="3" weight="bold" color={accent}>{value}</Text></Card>;
}

export default function SubscriptionSettings() {
  const { user } = useAuth();
  const administrator = isAdmin(user);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const current = useEntitlement();
  const plans = useAvailablePlans();
  const plan = plans.data?.find((item) => item.id === current?.plan);
  const expired = current?.status === "expired";
  const remaining = current?.expires_at
    ? Math.max(0, Math.ceil((new Date(current.expires_at).getTime() - now) / 86_400_000))
    : null;
  const enabled = Object.entries(current?.capabilities ?? {}).filter(([, value]) => administrator || value);

  return (
    <Box>
      <Text size="6" weight="bold">اشتراک من</Text>
      <Text as="div" size="2" color="gray" mt="1">وضعیت طرح، زمان باقی‌مانده و دسترسی‌های فعال حساب</Text>

      {expired && <Callout.Root color="red" mt="5" dir="rtl">
        <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
        <Callout.Text>اشتراک شما منقضی شده است. مشاهده موجودی همچنان فعال است، اما عملیات نوشتن و قابلیت‌های آنلاین تا تمدید اشتراک محدود هستند. برای تمدید با مدیر سامانه تماس بگیرید.</Callout.Text>
      </Callout.Root>}

      <Card mt="5" size="3">
        <Flex justify="between" align="start" wrap="wrap" gap="4">
          <Flex align="center" gap="3">
            <Box className="grid h-12 w-12 place-items-center rounded-xl bg-violet-500/10 text-violet-600"><StarIcon width="24" height="24" /></Box>
            <Box><Text size="2" color="gray">طرح فعلی</Text><Text as="div" size="6" weight="bold">{current?.label ?? "اطلاعات اشتراک"}</Text><Text size="1" color="gray">{current?.plan ?? "—"}</Text></Box>
          </Flex>
          <Flex gap="2" align="center" wrap="wrap">
            {administrator && <Badge color="violet" size="2">مدیر — دسترسی کامل</Badge>}
            <Badge color={expired ? "red" : "green"} size="2">{expired ? "منقضی" : "فعال"}</Badge>
          </Flex>
        </Flex>

        <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="3" mt="5">
          <InfoCard label="تاریخ خرید / شروع" value={date(current?.started_at)} />
          <InfoCard label="تاریخ انقضا" value={current?.expires_at ? date(current.expires_at) : "بدون انقضا"} accent={expired ? "red" : undefined} />
          <InfoCard label="زمان باقی‌مانده" value={remaining == null ? "نامحدود" : `${remaining} روز`} accent={expired ? "red" : "green"} />
          <InfoCard label="قیمت طرح" value={formatToman(plan?.price_minor ?? null)} accent="violet" />
        </Grid>

        <Separator size="4" my="5" />
        <Grid columns={{ initial: "1", md: "2" }} gap="5">
          <Box>
            <Text as="div" weight="bold">قابلیت‌های فعال</Text>
            <Flex direction="column" gap="2" mt="3">
              {enabled.map(([key]) => <Flex key={key} align="center" gap="2"><CheckCircledIcon color="var(--green-9)" /><Text size="2">{FEATURE_LABELS[key] ?? key}</Text></Flex>)}
              {enabled.length === 0 && <Text size="2" color="gray">قابلیت فعالی برای این طرح ثبت نشده است.</Text>}
            </Flex>
          </Box>
          <Box>
            <Text as="div" weight="bold">سقف استفاده</Text>
            <Grid columns="2" gap="3" mt="3">
              <InfoCard label="تعداد کالا" value={administrator || current?.limits.inventory_items == null ? "نامحدود" : String(current.limits.inventory_items)} />
              <InfoCard label="دستگاه فعال" value={administrator || current?.limits.devices == null ? "نامحدود" : String(current.limits.devices)} />
            </Grid>
            <Flex align="center" gap="2" mt="4"><ClockIcon /><Text size="1" color="gray">آخرین بررسی دسترسی: {date(current?.synced_at)}</Text></Flex>
          </Box>
        </Grid>
        {plan?.description && <Text as="div" size="2" color="gray" mt="5">{plan.description}</Text>}
        {administrator && <Callout.Root color="violet" mt="5"><Callout.Text>دسترسی مدیر مستقل از طرح اشتراک است و سرور مجوز کامل مدیریتی را اعمال می‌کند.</Callout.Text></Callout.Root>}
      </Card>
      <Text as="div" size="2" color="gray" mt="3">خرید و درگاه پرداخت در این مرحله فعال نیست؛ ساختار طرح‌ها برای اتصال آینده به پرداخت حفظ شده است.</Text>
    </Box>
  );
}
