import { useRef, useState } from "react";
import { Badge, Callout, Dialog, Flex, Grid, Select, Text, TextField } from "@radix-ui/themes";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button/button";
import { useCategories } from "@/features/setting/mutations/use-categories";
import { useBulkUpdateProducts } from "../mutations/use-products";
import {
  buildBulkProductIntent,
  hasBulkProductChanges,
  type BulkAlertChoice,
  type BulkCategoryChoice,
} from "../services/bulk-edit-intent";
import { normalizeIntegerText, normalizeOptionalInteger } from "../services/localized-integer";
import { LowStockThresholdField } from "./low-stock-threshold-field";

type Props = {
  open: boolean;
  selectedIds: number[];
  onOpenChange(open: boolean): void;
  onComplete(updatedIds: number[]): void;
};

export function BulkEditDialog({ open, selectedIds, onOpenChange, onComplete }: Props) {
  const { data: categories = [] } = useCategories();
  const mutation = useBulkUpdateProducts();
  const submitting = useRef(false);
  const [category, setCategory] = useState<BulkCategoryChoice>("unchanged");
  const [price, setPrice] = useState("");
  const [alert, setAlert] = useState<BulkAlertChoice>("unchanged");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);

  const values = { category, priceIncrease: price, alert, threshold };
  const intent = buildBulkProductIntent(values);
  const effective = hasBulkProductChanges(intent);
  const priceValue = normalizeOptionalInteger(price);
  const thresholdValue = normalizeOptionalInteger(threshold);

  const reset = () => {
    setCategory("unchanged");
    setPrice("");
    setAlert("unchanged");
    setThreshold("");
    setError(null);
  };

  const changeOpen = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (submitting.current || !effective) return;
    if ((priceValue !== undefined && !Number.isSafeInteger(priceValue)) ||
        (thresholdValue !== undefined && !Number.isSafeInteger(thresholdValue))) {
      setError("مقادیر عددی باید صحیح، نامنفی و در محدوده مجاز باشند"); return;
    }
    submitting.current = true; setError(null);
    try {
      const updated = await mutation.mutateAsync({ ids: selectedIds, intent });
      toast.success(`${updated.length.toLocaleString("fa-IR")} محصول به‌صورت محلی و پایدار ویرایش شد`);
      onComplete(updated.map((product) => product.id));
      reset();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ویرایش گروهی انجام نشد");
    } finally { submitting.current = false; }
  };

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Content dir="rtl" maxWidth="620px" className="max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom))] w-[calc(100vw-2rem)] overflow-y-auto">
      <Dialog.Title>
        <Flex align="center" gap="2">
          ویرایش گروهی محصولات
          <Badge color="violet">{selectedIds.length.toLocaleString("fa-IR")} محصول</Badge>
        </Flex>
      </Dialog.Title>
      <Dialog.Description className="sr-only">فقط فیلدهایی که مقدار می‌گیرند تغییر می‌کنند.</Dialog.Description>
      <Flex direction="column" gap="4" mt="5">
        <Grid columns={{ initial: "1", sm: "2" }} gap="4" align="start">
          <Flex direction="column" gap="2">
            <Text as="label" htmlFor="bulk-category" size="2" weight="medium">دسته‌بندی</Text>
            <Select.Root value={category} onValueChange={(value) => setCategory(value as BulkCategoryChoice)}>
              <Select.Trigger id="bulk-category" aria-label="دسته‌بندی جدید" />
              <Select.Content>
                <Select.Item value="unchanged">بدون تغییر</Select.Item>
                <Select.Item value="remove">حذف دسته‌بندی</Select.Item>
                {categories.map((item) => <Select.Item key={item.id} value={String(item.id)}>{item.name}</Select.Item>)}
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex direction="column" gap="2">
            <Text as="label" htmlFor="bulk-price" size="2" weight="medium">افزایش قیمت</Text>
            <TextField.Root id="bulk-price" value={price} inputMode="numeric" placeholder="بدون تغییر" onChange={(event) => setPrice(normalizeIntegerText(event.target.value))}>
              <TextField.Slot side="right">تومان</TextField.Slot>
            </TextField.Root>
          </Flex>
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">وضعیت هشدار موجودی</Text>
            <Select.Root value={alert} onValueChange={(value) => setAlert(value as BulkAlertChoice)}>
              <Select.Trigger aria-label="وضعیت هشدار موجودی" />
              <Select.Content>
                <Select.Item value="unchanged">بدون تغییر</Select.Item>
                <Select.Item value="enable">فعال</Select.Item>
                <Select.Item value="disable">غیرفعال</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
          <LowStockThresholdField id="bulk-low-stock-threshold" value={threshold} optional onValueChange={setThreshold} />
        </Grid>
        {error && <Callout.Root color="red" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      </Flex>
      <Flex justify="end" gap="2" mt="5" wrap="wrap-reverse">
        <Dialog.Close><Button variant="soft" color="gray" disabled={mutation.isPending}>انصراف</Button></Dialog.Close>
        <Button intent="positive" disabled={!effective} loading={mutation.isPending} onClick={() => void submit()}>اعمال تغییرات</Button>
      </Flex>
    </Dialog.Content>
  </Dialog.Root>;
}
