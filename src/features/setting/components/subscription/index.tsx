import { useEntitlement } from "@/shared/access/use-entitlement";
import { Badge, Box, Card, Flex, Grid, Text } from "@radix-ui/themes";
import { useAvailablePlans } from "../../mutations/use-admin";
import { useEffect, useState } from "react";
import { useAuth } from "@/shared/auth/use-auth";
import { isAdmin } from "@/shared/access/authorization";

const featureLabels: Record<string, string> = {
  "inventory.read": "مشاهده موجودی",
  "inventory.write": "مدیریت محصولات",
  "categories.write": "مدیریت دسته‌بندی‌ها",
  "catalog.manage": "کاتالوگ",
  "industry.manage": "حوزه کاری",
  "export.local": "خروجی آفلاین",
  "export.server": "خروجی آنلاین",
  backup: "پشتیبان‌گیری",
};

const date = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("fa-IR").format(new Date(value)) : "—";

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
  const remaining = current?.expires_at
    ? Math.max(0, Math.ceil((new Date(current.expires_at).getTime() - now) / 86_400_000))
    : null;
  const enabled = Object.entries(current?.capabilities ?? {}).filter(([, value]) => administrator || value);

  return (
    <Box>
      <Text size="6" weight="bold">اشتراک</Text>
      <Card mt="5">
        <Flex justify="between" align="center" wrap="wrap" gap="3">
          <Box><Text size="5" weight="bold">{current?.label ?? "اطلاعات اشتراک"}</Text><Text as="div" size="2" color="gray">شناسه طرح: {current?.plan ?? "—"}</Text></Box>
          <Flex gap="2" align="center">
            {administrator && <Badge color="violet">مدیر — دسترسی کامل</Badge>}
            <Badge color={current?.status === "expired" ? "red" : "green"}>{current?.status === "expired" ? "منقضی" : "فعال"}</Badge>
          </Flex>
        </Flex>
        <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="3" mt="4">
          <Text>شروع: {date(current?.started_at)}</Text>
          <Text>انقضا: {date(current?.expires_at)}</Text>
          <Text>زمان باقی‌مانده: {remaining == null ? "بدون انقضا" : `${remaining} روز`}</Text>
          <Text>آخرین همگام‌سازی: {date(current?.synced_at)}</Text>
        </Grid>
        <Text as="div" weight="bold" mt="5">امکانات فعال</Text>
        <Grid columns={{ initial: "1", sm: "2" }} gap="2" mt="2">
          {enabled.map(([key]) => <Text key={key} color="green">✓ {featureLabels[key] ?? key}</Text>)}
        </Grid>
        <Text as="div" weight="bold" mt="5">محدودیت‌ها</Text>
        <Flex gap="4" mt="2" wrap="wrap">
          <Text>کالا: {administrator ? "نامحدود" : current?.limits.inventory_items ?? "نامحدود"}</Text>
          <Text>دستگاه: {administrator ? "نامحدود" : current?.limits.devices ?? "نامحدود"}</Text>
        </Flex>
        {administrator && <Text as="div" color="violet" size="2" mt="4">دسترسی‌های مدیر مستقل از طرح اشتراک هستند و همه بخش‌ها و قابلیت‌ها برای این حساب فعال‌اند.</Text>}
      </Card>

      {plan && <Text as="div" size="2" color="gray" mt="4">{plan.description || ""}</Text>}
      <Text as="div" size="2" color="gray" mt="2">خرید و پرداخت در فاز بعدی فعال خواهد شد.</Text>
    </Box>
  );
}
