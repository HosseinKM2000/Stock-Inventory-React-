import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { BarChartIcon, InfoCircledIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { Box, Card, Checkbox, Dialog, Flex, Grid, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCreatePlan, useUpdatePlan } from "../../mutations/use-admin";
import type { SubscriptionPlan, SubscriptionPlanInput } from "../../types";
import { adminErrorMessage } from "../admin-error";
import { PLAN_FEATURE_OPTIONS, PLAN_LIMIT_OPTIONS, priceMinorToToman, tomanToPriceMinor } from "./plan-options";

type Props = { plan?: SubscriptionPlan; trigger: ReactNode };
type DurationUnit = "day" | "month" | "year";

const groups = ["آفلاین و موجودی", "داده و خروجی"] as const;

export default function PlanDialog({ plan, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<SubscriptionPlanInput | null>(null);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState<DurationUnit>("day");
  const [active, setActive] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, string>>({});
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const pending = create.isPending || update.isPending;

  const featureOptions = useMemo(() => {
    const known = new Set(PLAN_FEATURE_OPTIONS.map((option) => option.key));
    return [
      ...PLAN_FEATURE_OPTIONS,
      ...Object.keys(features).filter((key) => !known.has(key)).map((key) => ({
        key, label: key, description: "قابلیت سفارشی موجود در این طرح", group: "داده و خروجی" as const,
      })),
    ];
  }, [features]);

  function resetForm() {
    setId(plan?.id ?? "");
    setName(plan?.name ?? "");
    setDescription(plan?.description ?? "");
    setPrice(plan?.price_minor == null ? "" : String(priceMinorToToman(plan.price_minor)));
    setDuration(plan?.duration == null ? "" : String(plan.duration));
    setUnit(plan?.duration_unit ?? "day");
    setActive(plan?.is_active ?? true);
    setFeatures({
      ...Object.fromEntries(PLAN_FEATURE_OPTIONS.map((option) => [option.key, false])),
      ...(plan?.features ?? {}),
    });
    setLimits(Object.fromEntries([
      ...PLAN_LIMIT_OPTIONS.map((option) => [option.key, plan?.limits[option.key] == null ? "" : String(plan.limits[option.key])]),
      ...Object.entries(plan?.limits ?? {}).filter(([key]) => !PLAN_LIMIT_OPTIONS.some((option) => option.key === key)).map(([key, value]) => [key, value == null ? "" : String(value)]),
    ]));
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    if (!pending) setOpen(next);
  }

  function review() {
    if (!id.trim() || !name.trim()) {
      toast.error("شناسه و نام طرح الزامی هستند");
      return;
    }
    const parsedPrice = price === "" ? null : Number(price);
    const parsedDuration = duration === "" ? null : Number(duration);
    const parsedLimits = Object.fromEntries(Object.entries(limits).map(([key, value]) => [key, value === "" ? null : Number(value)]));
    if ((parsedPrice !== null && (!Number.isInteger(parsedPrice) || parsedPrice < 0)) ||
        (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1)) ||
        Object.values(parsedLimits).some((value) => value !== null && (!Number.isInteger(value) || value < 1))) {
      toast.error("قیمت باید نامنفی و مدت و محدودیت‌ها باید عدد صحیح مثبت باشند");
      return;
    }
    setDraft({
      id: id.trim(), name: name.trim(), description: description.trim() || null,
      price_minor: tomanToPriceMinor(parsedPrice), currency: "IRR", duration: parsedDuration,
      duration_unit: parsedDuration === null ? null : unit, is_active: active,
      features, limits: parsedLimits,
    });
    setConfirmOpen(true);
  }

  async function save() {
    if (!draft) return;
    try {
      if (plan) await update.mutateAsync({ id: plan.id, plan: draft });
      else await create.mutateAsync(draft);
      toast.success("طرح اشتراک ذخیره شد");
      setConfirmOpen(false);
      setOpen(false);
    } catch (error) {
      toast.error(adminErrorMessage(error, "ذخیره طرح ناموفق بود"));
    }
  }

  return <>
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="760px" dir="rtl" className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <Dialog.Title>{plan ? "ویرایش طرح اشتراک" : "ایجاد طرح اشتراک"}</Dialog.Title>
        <Dialog.Description color="gray">اطلاعات تجاری و دسترسی‌ها را بدون نیاز به ویرایش JSON تنظیم کنید.</Dialog.Description>
        <Flex direction="column" gap="5" mt="5">
          <Card>
            <Flex align="center" gap="3" mb="3"><Box className="card-title-icon" aria-hidden="true"><InfoCircledIcon width="20" height="20" /></Box><Text as="div" weight="bold">اطلاعات پایه</Text></Flex>
            <Grid columns={{ initial: "1", sm: "2" }} gap="3">
              <label><Text size="2">شناسه پایدار</Text><TextField.Root value={id} disabled={Boolean(plan)} onChange={(event) => setId(event.target.value)} /></label>
              <label><Text size="2">نام طرح</Text><TextField.Root value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="sm:col-span-2"><Text size="2">توضیحات</Text><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <label><Text size="2">قیمت (تومان)</Text><TextField.Root type="number" min="0" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
              <Grid columns="2" gap="2">
                <label><Text size="2">مدت</Text><TextField.Root type="number" min="1" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
                <label><Text size="2">واحد</Text><Select.Root value={unit} onValueChange={(value) => setUnit(value as DurationUnit)} disabled={!duration}><Select.Trigger /><Select.Content><Select.Item value="day">روز</Select.Item><Select.Item value="month">ماه</Select.Item><Select.Item value="year">سال</Select.Item></Select.Content></Select.Root></label>
              </Grid>
            </Grid>
            <Flex align="center" gap="2" mt="4"><Switch checked={active} onCheckedChange={setActive} /><Text>طرح برای تخصیص به کاربران فعال باشد</Text></Flex>
          </Card>

          <Card>
            <Flex align="center" gap="3"><Box className="card-title-icon" aria-hidden="true"><LightningBoltIcon width="20" height="20" /></Box><Text as="div" weight="bold">قابلیت‌های طرح</Text></Flex>
            <Text as="div" size="2" color="gray" mb="4">قابلیت‌های فعال توسط سرور به مجوزهای حساب تبدیل می‌شوند.</Text>
            <Flex direction="column" gap="5">
              {groups.map((group) => <Box key={group}>
                <Text as="div" size="2" weight="bold" mb="2">{group}</Text>
                <Grid columns={{ initial: "1", sm: "2" }} gap="2">
                  {featureOptions.filter((option) => option.group === group).map((option) => <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-foreground/10 p-3 hover:bg-foreground/5">
                    <Checkbox mt="1" checked={Boolean(features[option.key])} onCheckedChange={(checked) => setFeatures((current) => ({ ...current, [option.key]: checked === true }))} />
                    <span><Text as="div" size="2" weight="medium">{option.label}</Text><Text as="div" size="1" color="gray">{option.description}</Text></span>
                  </label>)}
                </Grid>
              </Box>)}
            </Flex>
          </Card>

          <Card>
            <Flex align="center" gap="3" mb="3"><Box className="card-title-icon" aria-hidden="true"><BarChartIcon width="20" height="20" /></Box><Text as="div" weight="bold">محدودیت‌های استفاده</Text></Flex>
            <Grid columns={{ initial: "1", sm: "2" }} gap="3">
              {PLAN_LIMIT_OPTIONS.map((option) => <label key={option.key}><Text size="2">{option.label}</Text><TextField.Root type="number" min="1" inputMode="numeric" placeholder={option.description} value={limits[option.key] ?? ""} onChange={(event) => setLimits((current) => ({ ...current, [option.key]: event.target.value }))} /></label>)}
            </Grid>
          </Card>
        </Flex>
        <Flex justify="end" gap="2" mt="5" wrap="wrap-reverse"><Dialog.Close><Button variant="soft" color="gray">انصراف</Button></Dialog.Close><Button loading={pending} onClick={review}>{plan ? "بررسی تغییرات" : "بررسی و ایجاد"}</Button></Flex>
      </Dialog.Content>
    </Dialog.Root>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={plan ? "تأیید تغییرات طرح" : "تأیید ایجاد طرح"}
      description={plan ? `تغییرات طرح «${name}» بلافاصله بر دسترسی مشترکان آن اثر می‌گذارد.` : `طرح «${name}» با قیمت و قابلیت‌های انتخاب‌شده ایجاد می‌شود.`}
      confirmLabel={plan ? "ذخیره تغییرات" : "ایجاد طرح"}
      variant="warning"
      loading={pending}
      onConfirm={() => { void save(); }}
    />
  </>;
}
