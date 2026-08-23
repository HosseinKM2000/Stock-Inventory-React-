import { Button } from "@/shared/ui/button/button";
import { Dialog, Flex, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useCreatePlan, useUpdatePlan } from "../../mutations/use-admin";
import type { SubscriptionPlan } from "../../types";
import { adminErrorMessage } from "../admin-error";

type Props = { plan?: SubscriptionPlan; trigger: ReactNode };

export default function PlanDialog({ plan, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(plan?.id ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan?.price_minor == null ? "" : String(plan.price_minor));
  const [duration, setDuration] = useState(plan?.duration == null ? "" : String(plan.duration));
  const [unit, setUnit] = useState<"day" | "month" | "year">(plan?.duration_unit ?? "day");
  const [active, setActive] = useState(plan?.is_active ?? true);
  const [features, setFeatures] = useState(JSON.stringify(plan?.features ?? {}, null, 2));
  const [limits, setLimits] = useState(JSON.stringify(plan?.limits ?? {}, null, 2));
  const create = useCreatePlan();
  const update = useUpdatePlan();

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setId(plan?.id ?? "");
      setName(plan?.name ?? "");
      setDescription(plan?.description ?? "");
      setPrice(plan?.price_minor == null ? "" : String(plan.price_minor));
      setDuration(plan?.duration == null ? "" : String(plan.duration));
      setUnit(plan?.duration_unit ?? "day");
      setActive(plan?.is_active ?? true);
      setFeatures(JSON.stringify(plan?.features ?? {}, null, 2));
      setLimits(JSON.stringify(plan?.limits ?? {}, null, 2));
    }
    setOpen(next);
  };

  const submit = async () => {
    try {
      if (!id.trim() || !name.trim()) {
        toast.error("شناسه و نام طرح الزامی هستند");
        return;
      }
      const featureValue = JSON.parse(features) as Record<string, boolean>;
      const limitValue = JSON.parse(limits) as Record<string, number | null>;
      if (
        !featureValue || Array.isArray(featureValue) ||
        Object.values(featureValue).some((value) => typeof value !== "boolean") ||
        !limitValue || Array.isArray(limitValue) ||
        Object.values(limitValue).some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value)))
      ) {
        toast.error("امکانات باید مقادیر بولی و محدودیت‌ها باید مقادیر عددی یا null داشته باشند");
        return;
      }
      const parsedPrice = price === "" ? null : Number(price);
      const parsedDuration = duration === "" ? null : Number(duration);
      if ((parsedPrice !== null && (!Number.isInteger(parsedPrice) || parsedPrice < 0)) ||
          (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1))) {
        toast.error("قیمت باید عدد صحیح نامنفی و مدت باید عدد صحیح مثبت باشد");
        return;
      }
      const value = {
        id,
        name,
        description: description || null,
        price_minor: parsedPrice,
        currency: plan?.currency ?? "IRR",
        duration: parsedDuration,
        duration_unit: duration === "" ? null : unit,
        is_active: active,
        features: featureValue,
        limits: limitValue,
      };
      if (plan) await update.mutateAsync({ id: plan.id, plan: value });
      else await create.mutateAsync(value);
      toast.success("طرح اشتراک ذخیره شد");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof SyntaxError ? "ساختار JSON امکانات یا محدودیت‌ها معتبر نیست" : adminErrorMessage(error, "ذخیره طرح ناموفق بود"));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="680px" dir="rtl">
        <Dialog.Title>{plan ? "ویرایش طرح" : "طرح جدید"}</Dialog.Title>
        <Flex direction="column" gap="3" mt="4">
          <label><Text size="2">شناسه پایدار</Text><TextField.Root value={id} disabled={Boolean(plan)} onChange={(event) => setId(event.target.value)} /></label>
          <label><Text size="2">نام</Text><TextField.Root value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><Text size="2">توضیحات</Text><TextArea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <Flex gap="3" wrap="wrap">
            <label className="flex-1"><Text size="2">قیمت (واحد خرد)</Text><TextField.Root type="number" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label className="flex-1"><Text size="2">مدت</Text><TextField.Root type="number" value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
            <label><Text size="2">واحد مدت</Text><select className="block h-8 rounded-md border bg-transparent px-2" value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}><option value="day">روز</option><option value="month">ماه</option><option value="year">سال</option></select></label>
          </Flex>
          <label><Text size="2">امکانات (JSON)</Text><TextArea rows={7} value={features} onChange={(event) => setFeatures(event.target.value)} /></label>
          <label><Text size="2">محدودیت‌ها (JSON)</Text><TextArea rows={5} value={limits} onChange={(event) => setLimits(event.target.value)} /></label>
          <Flex align="center" gap="2"><Switch checked={active} onCheckedChange={setActive} /><Text>طرح فعال است</Text></Flex>
        </Flex>
        <Flex justify="end" gap="2" mt="5"><Dialog.Close><Button variant="soft">انصراف</Button></Dialog.Close><Button loading={create.isPending || update.isPending} onClick={submit}>ذخیره</Button></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
