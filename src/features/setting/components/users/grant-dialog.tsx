import type { AdminUser } from "@/features/auth/types";
import { Button } from "@/shared/ui/button/button";
import { Dialog, Flex, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateStorePlanGrant } from "../../mutations/use-admin";
import { adminErrorMessage } from "../admin-error";
import { JalaliDateField } from "@/shared/ui/date/jalali-date-field";
import { parseJalaliDateTime } from "@/shared/lib/date/jalali";

export function GrantDialog({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<"personal" | "pro" | "vip">("pro");
  const [source, setSource] = useState("early_user_gift");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [requestId, setRequestId] = useState("");
  const create = useCreateStorePlanGrant();

  function changeOpen(next: boolean) {
    if (next) setRequestId(crypto.randomUUID());
    if (!create.isPending) setOpen(next);
  }

  async function submit() {
    const startsAt = parseJalaliDateTime(startDate, startTime);
    const endsAt = parseJalaliDateTime(endDate, endTime);
    if (!user.store_id || !startsAt || !endsAt || startsAt >= endsAt || reason.trim().length < 3) {
      toast.error("فروشگاه، بازه معتبر و دلیل صریح الزامی است");
      return;
    }
    try {
      await create.mutateAsync({
        request_id: requestId,
        store_id: user.store_id,
        plan_id: plan,
        source,
        reason: reason.trim(),
        starts_at: startsAt,
        ends_at: endsAt,
      });
      toast.success("گرنت زمان‌دار ثبت شد");
      setOpen(false);
    } catch (error) {
      toast.error(adminErrorMessage(error, "ثبت گرنت ناموفق بود"));
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger><Button size="2" variant="soft" disabled={!user.store_id}>گرنت موقت</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="560px" dir="rtl" className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <Dialog.Title>اعطای طرح پولی زمان‌دار</Dialog.Title>
        <Dialog.Description>گرنت جای اشتراک پایه را نمی‌گیرد و پس از پایان، همان اشتراک پایه دوباره مؤثر می‌شود.</Dialog.Description>
        <Flex direction="column" gap="3" mt="4">
          <label><Text size="2">طرح واقعی</Text><Select.Root value={plan} onValueChange={(value) => setPlan(value as "personal" | "pro" | "vip")}><Select.Trigger /><Select.Content><Select.Item value="personal">شخصی</Select.Item><Select.Item value="pro">حرفه‌ای</Select.Item><Select.Item value="vip">تیم</Select.Item></Select.Content></Select.Root></label>
          <label><Text size="2">منبع</Text><Select.Root value={source} onValueChange={setSource}><Select.Trigger /><Select.Content><Select.Item value="early_user_gift">هدیه کاربر اولیه</Select.Item><Select.Item value="support">پشتیبانی</Select.Item><Select.Item value="promotion">کمپین</Select.Item><Select.Item value="manual">دستی</Select.Item></Select.Content></Select.Root></label>
          <fieldset className="grant-date-time"><legend>شروع به وقت تهران</legend><JalaliDateField id="grant-start-date" label="تاریخ جلالی" value={startDate} onChange={setStartDate} /><label htmlFor="grant-start-time"><Text size="2">ساعت ۲۴ ساعته</Text><TextField.Root id="grant-start-time" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="۰۹:۳۰" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label></fieldset>
          <fieldset className="grant-date-time"><legend>پایان صریح به وقت تهران</legend><JalaliDateField id="grant-end-date" label="تاریخ جلالی" value={endDate} onChange={setEndDate} /><label htmlFor="grant-end-time"><Text size="2">ساعت ۲۴ ساعته</Text><TextField.Root id="grant-end-time" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="۱۷:۰۰" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></fieldset>
          <label><Text size="2">دلیل ممیزی</Text><TextArea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </Flex>
        <Flex justify="end" gap="2" mt="5"><Dialog.Close><Button variant="soft" color="gray">انصراف</Button></Dialog.Close><Button loading={create.isPending} onClick={() => { void submit(); }}>ثبت گرنت</Button></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
