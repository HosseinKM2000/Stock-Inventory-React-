import { useRef, useState } from "react";
import { Dialog, Flex, Grid, Select, Text, TextField, Checkbox, Callout } from "@radix-ui/themes";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button/button";
import { useCategories } from "@/features/setting/mutations/use-categories";
import { useBulkUpdateProducts } from "../mutations/use-products";
import type { BulkProductIntent } from "../services/inventory-service";

type Props = {
  open: boolean;
  selectedIds: number[];
  onOpenChange(open: boolean): void;
  onComplete(updatedIds: number[]): void;
};

const digits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
  .replace(/[,٬]/g, "").replace(/\D/g, "");

export function BulkEditDialog({ open, selectedIds, onOpenChange, onComplete }: Props) {
  const { data: categories = [] } = useCategories();
  const mutation = useBulkUpdateProducts();
  const submitting = useRef(false);
  const [categoryEnabled, setCategoryEnabled] = useState(false);
  const [category, setCategory] = useState("none");
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState("");
  const [alert, setAlert] = useState<"unchanged" | "enable" | "disable">("unchanged");
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);

  const priceValue = price === "" ? 0 : Number(digits(price));
  const thresholdValue = threshold === "" ? 0 : Number(digits(threshold));
  const effective = categoryEnabled || (priceEnabled && priceValue > 0) || alert !== "unchanged" || thresholdEnabled;
  const summary = [
    categoryEnabled ? (category === "none" ? "حذف دسته‌بندی" : "تغییر دسته‌بندی") : null,
    priceEnabled && priceValue > 0 ? `افزایش ${priceValue.toLocaleString("fa-IR")} تومان` : null,
    alert === "enable" ? "فعال‌سازی هشدار" : alert === "disable" ? "غیرفعال‌سازی هشدار" : null,
    thresholdEnabled ? `حد هشدار ${thresholdValue.toLocaleString("fa-IR")}` : null,
  ].filter(Boolean).join("، ");

  const submit = async () => {
    if (submitting.current || !effective) return;
    if ((priceEnabled && (!Number.isSafeInteger(priceValue) || priceValue < 0)) ||
        (thresholdEnabled && (!Number.isSafeInteger(thresholdValue) || thresholdValue < 0))) {
      setError("مقادیر عددی باید صحیح، نامنفی و در محدوده مجاز باشند"); return;
    }
    const intent: BulkProductIntent = {
      ...(categoryEnabled ? { categoryId: category === "none" ? null : Number(category) } : {}),
      ...(priceEnabled && priceValue > 0 ? { priceIncrease: priceValue } : {}),
      ...(alert !== "unchanged" ? { lowStockAlert: alert === "enable" } : {}),
      ...(thresholdEnabled ? { lowStockThreshold: thresholdValue } : {}),
    };
    submitting.current = true; setError(null);
    try {
      const updated = await mutation.mutateAsync({ ids: selectedIds, intent });
      toast.success(`${updated.length.toLocaleString("fa-IR")} محصول به‌صورت محلی و پایدار ویرایش شد`);
      onComplete(updated.map((product) => product.id));
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ویرایش گروهی انجام نشد");
    } finally { submitting.current = false; }
  };

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!mutation.isPending) onOpenChange(next); }}>
    <Dialog.Content dir="rtl" maxWidth="620px" className="max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom))] w-[calc(100vw-2rem)] overflow-y-auto">
      <Dialog.Title>ویرایش گروهی محصولات</Dialog.Title>
      <Dialog.Description color="gray">{selectedIds.length.toLocaleString("fa-IR")} محصول انتخاب شده است. فقط گزینه‌هایی که فعال می‌کنید تغییر می‌کنند.</Dialog.Description>
      <Flex direction="column" gap="4" mt="5">
        <Grid columns={{ initial: "1", sm: "2" }} gap="3" align="end">
          <label className="flex items-center gap-2"><Checkbox checked={categoryEnabled} onCheckedChange={(value) => setCategoryEnabled(value === true)} /><Text>تغییر دسته‌بندی</Text></label>
          <Select.Root value={category} disabled={!categoryEnabled} onValueChange={setCategory}><Select.Trigger aria-label="دسته‌بندی جدید" /><Select.Content><Select.Item value="none">بدون دسته‌بندی</Select.Item>{categories.map((item) => <Select.Item key={item.id} value={String(item.id)}>{item.name}</Select.Item>)}</Select.Content></Select.Root>
          <label className="flex items-center gap-2"><Checkbox checked={priceEnabled} onCheckedChange={(value) => setPriceEnabled(value === true)} /><Text>افزایش قیمت</Text></label>
          <TextField.Root value={price} disabled={!priceEnabled} inputMode="numeric" placeholder="مبلغ افزایشی به تومان" onChange={(event) => setPrice(digits(event.target.value))}><TextField.Slot side="right">تومان</TextField.Slot></TextField.Root>
          <Text>وضعیت هشدار موجودی</Text>
          <Select.Root value={alert} onValueChange={(value) => setAlert(value as typeof alert)}><Select.Trigger /><Select.Content><Select.Item value="unchanged">بدون تغییر</Select.Item><Select.Item value="enable">فعال</Select.Item><Select.Item value="disable">غیرفعال</Select.Item></Select.Content></Select.Root>
          <label className="flex items-center gap-2"><Checkbox checked={thresholdEnabled} onCheckedChange={(value) => setThresholdEnabled(value === true)} /><Text>تغییر حد هشدار</Text></label>
          <TextField.Root value={threshold} disabled={!thresholdEnabled} inputMode="numeric" placeholder="حد هشدار" onChange={(event) => setThreshold(digits(event.target.value))} />
        </Grid>
        {summary && <Callout.Root color="violet" role="status"><Callout.Text>{summary}</Callout.Text></Callout.Root>}
        {error && <Callout.Root color="red" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      </Flex>
      <Flex justify="end" gap="2" mt="5" wrap="wrap-reverse"><Dialog.Close><Button variant="soft" color="gray" disabled={mutation.isPending}>انصراف</Button></Dialog.Close><Button disabled={!effective} loading={mutation.isPending} onClick={() => void submit()}>اعمال تغییرات</Button></Flex>
    </Dialog.Content>
  </Dialog.Root>;
}
