import { useState } from "react";
import { Callout, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { toast } from "sonner";
import type { AdminUser } from "@/features/auth/types";
import { Button } from "@/shared/ui/button/button";
import { useSetUserDevicePolicy } from "../../mutations/use-admin";

export function DevicePolicyEditor({ user }: { user: AdminUser }) {
  const [mode, setMode] = useState(user.device_limit_mode);
  const [limit, setLimit] = useState(user.device_limit_override?.toString() ?? "");
  const mutation = useSetUserDevicePolicy();
  const effective = user.effective_device_limit == null
    ? "نامحدود"
    : `${user.effective_device_limit.toLocaleString("fa-IR")} دستگاه فعال`;
  const source = user.device_limit_source === "plan" ? "طرح" : "تنظیم کاربر";
  const parsed = limit === "" ? null : Number(limit);
  const valid = mode !== "limited" || (Number.isSafeInteger(parsed) && Number(parsed) > 0);

  const save = async () => {
    if (!valid) return;
    try {
      await mutation.mutateAsync({ id: user.id, mode, limit: mode === "limited" ? parsed : null });
      toast.success("سیاست دستگاه کاربر ذخیره شد");
    } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیره سیاست دستگاه انجام نشد"); }
  };

  return <Flex direction="column" gap="2" className="rounded-xl border border-[var(--gray-a5)] p-3" dir="rtl">
    <Text size="2" weight="bold">دستگاه‌ها و نشست‌های فعال</Text>
    <Text size="1" color="gray">اکنون {user.active_session_count.toLocaleString("fa-IR")} نشست فعال · سیاست مؤثر: {effective} از {source}</Text>
    <Select.Root value={mode} onValueChange={(value) => setMode(value as typeof mode)} disabled={mutation.isPending}><Select.Trigger aria-label={`سیاست دستگاه ${user.username}`} /><Select.Content><Select.Item value="inherit">ارث‌بری از طرح</Select.Item><Select.Item value="unlimited">نامحدود</Select.Item><Select.Item value="limited">محدود</Select.Item></Select.Content></Select.Root>
    {mode === "limited" && <TextField.Root type="number" min="1" inputMode="numeric" value={limit} placeholder="حداکثر دستگاه فعال" onChange={(event) => setLimit(event.target.value)} />}
    {mode === "limited" && parsed !== null && parsed < user.active_session_count && <Callout.Root color="amber" size="1"><Callout.Text>نشست فعلی حذف نمی‌شود؛ ورود دستگاه جدید تا کاهش نشست‌ها رد خواهد شد.</Callout.Text></Callout.Root>}
    <Button intent="positive" size="1" variant="soft" disabled={!valid} loading={mutation.isPending} onClick={() => void save()}>ذخیره سیاست دستگاه</Button>
  </Flex>;
}
