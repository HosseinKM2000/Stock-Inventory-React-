import type { AdminUser } from "@/features/auth/types";
import { Button } from "@/shared/ui/button/button";
import {
  CalendarIcon,
  ClockIcon,
  EnvelopeClosedIcon,
  EyeOpenIcon,
  IdCardIcon,
  MobileIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Dialog, Flex, Grid, Separator, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

type Props = { user: AdminUser };

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "نامعتبر" : dateTimeFormatter.format(date);
}

function DetailItem({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <Flex align="start" gap="3" className="rounded-xl border border-[var(--gray-a5)] p-3">
      <Box className="card-metric-icon" aria-hidden="true">{icon}</Box>
      <Box className="min-w-0">
        <Text as="div" size="1" color="gray">{label}</Text>
        <Text as="div" size="2" weight="medium" className="mt-1 break-words">{value}</Text>
      </Box>
    </Flex>
  );
}

export function UserDetailsDialog({ user }: Props) {
  const fullName = `${user.first_name} ${user.last_name}`.trim();

  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button size="2" variant="outline"><EyeOpenIcon />مشاهده جزئیات</Button>
      </Dialog.Trigger>

      <Dialog.Content
        dir="rtl"
        maxWidth="720px"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <Dialog.Title>جزئیات کامل کاربر</Dialog.Title>
        <Dialog.Description color="gray">اطلاعات حساب، دسترسی، اشتراک و فعالیت کاربر</Dialog.Description>

        <Flex align="center" gap="3" mt="5" wrap="wrap">
          <Box className="card-title-icon" aria-hidden="true"><PersonIcon width="20" height="20" /></Box>
          <Box className="min-w-0 flex-1">
            <Text as="div" size="5" weight="bold" className="break-words">{fullName || "بدون نام"}</Text>
            <Text as="div" size="2" color="gray" dir="ltr" className="text-right">@{user.username}</Text>
          </Box>
          <Flex gap="2" wrap="wrap">
            <Badge color={user.is_active ? "green" : "red"}>{user.is_active ? "فعال" : "غیرفعال"}</Badge>
            <Badge color={user.role === "ADMIN" ? "violet" : "gray"}>{user.role === "ADMIN" ? "مدیر" : "کاربر"}</Badge>
            {user.is_system_admin && <Badge color="amber">مدیر دائمی سیستم</Badge>}
          </Flex>
        </Flex>

        <Separator size="4" my="5" />

        <Text as="div" weight="bold" mb="3">اطلاعات هویتی و تماس</Text>
        <Grid columns={{ initial: "1", sm: "2" }} gap="3">
          <DetailItem label="شناسه کاربر" value={user.id.toLocaleString("fa-IR")} icon={<IdCardIcon />} />
          <DetailItem label="شناسه حوزه کاری" value={user.industry_id?.toLocaleString("fa-IR") ?? "تعیین نشده"} icon={<IdCardIcon />} />
          <DetailItem label="ایمیل" value={<span dir="ltr">{user.email || "ثبت نشده"}</span>} icon={<EnvelopeClosedIcon />} />
          <DetailItem label="شماره تلفن" value={<span dir="ltr">{user.phone || "ثبت نشده"}</span>} icon={<MobileIcon />} />
        </Grid>

        <Text as="div" weight="bold" mt="5" mb="3">حساب و دسترسی</Text>
        <Grid columns={{ initial: "1", sm: "2" }} gap="3">
          <DetailItem label="نقش حساب" value={user.role === "ADMIN" ? "مدیر" : "کاربر"} icon={<PersonIcon />} />
          <DetailItem label="دسترسی مدیریتی" value={user.is_admin ? "دارد" : "ندارد"} icon={<IdCardIcon />} />
          <DetailItem label="مدیر دائمی سیستم" value={user.is_system_admin ? "بله" : "خیر"} icon={<IdCardIcon />} />
          <DetailItem label="وضعیت حساب" value={user.is_active ? "فعال" : "غیرفعال"} icon={<PersonIcon />} />
        </Grid>

        <Text as="div" weight="bold" mt="5" mb="3">اشتراک</Text>
        <Grid columns={{ initial: "1", sm: "2" }} gap="3">
          <DetailItem label="طرح اشتراک" value={user.plan} icon={<IdCardIcon />} />
          <DetailItem label="وضعیت اشتراک" value={user.subscription_status === "active" ? "فعال" : "منقضی"} icon={<ClockIcon />} />
          <DetailItem label="شروع اشتراک" value={formatDateTime(user.subscription_started_at)} icon={<CalendarIcon />} />
          <DetailItem label="پایان اشتراک" value={formatDateTime(user.subscription_expires_at)} icon={<CalendarIcon />} />
          <DetailItem label="روزهای باقی‌مانده" value={user.remaining_days == null ? "نامحدود" : `${user.remaining_days.toLocaleString("fa-IR")} روز`} icon={<ClockIcon />} />
        </Grid>

        <Text as="div" weight="bold" mt="5" mb="3">فعالیت حساب</Text>
        <Grid columns={{ initial: "1", sm: "2" }} gap="3">
          <DetailItem label="تاریخ ثبت‌نام" value={formatDateTime(user.created_at)} icon={<CalendarIcon />} />
          <DetailItem label="آخرین فعالیت" value={formatDateTime(user.last_activity_at)} icon={<ClockIcon />} />
        </Grid>

        <Flex justify="end" mt="5">
          <Dialog.Close><Button variant="soft" color="gray">بستن</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
