import { Badge, Box, Callout, Card, Flex, RadioGroup, Select, Text, TextField } from "@radix-ui/themes";
import { PlusIcon, ReaderIcon, TokensIcon, TrashIcon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { Product } from "@/features/app/inventory/types";
import { accessState } from "@/shared/access/access-state";
import { Button } from "@/shared/ui/button/button";
import { barcodeRepository } from "../services/barcode-repository";
import { barcodeService } from "../services/barcode-service";
import type { BarcodeMeaning, ProductBarcode } from "../types";
import { LabelPrintDialog } from "./label-print-dialog";

type Props = { product: Product; readOnly?: boolean };

export function BarcodeManager({ product, readOnly = false }: Props) {
  const [items, setItems] = useState<ProductBarcode[]>([]);
  const [value, setValue] = useState("");
  const [meaning, setMeaning] = useState<BarcodeMeaning>("unit");
  const [scanQuantity, setScanQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const canManage = !readOnly && accessState.canWrite() && accessState.canUse("barcode.manage") && accessState.hasStorePermission("barcodes.manage");
  const canPrint = accessState.canUse("label.print") && accessState.hasStorePermission("labels.print");

  const refresh = useCallback(async () => setItems(await barcodeRepository.forProduct(product.id)), [product.id]);
  useEffect(() => {
    let active = true;
    void barcodeRepository.forProduct(product.id).then((next) => { if (active) setItems(next); });
    return () => { active = false; };
  }, [product.id]);

  const add = async (generate = false) => {
    setBusy(true);
    try {
      if (generate) {
        await barcodeService.generate(product.id, meaning, Number(scanQuantity));
      } else {
        await barcodeService.create({ productId: product.id, value, source: "manufacturer", meaning, scanQuantity: Number(scanQuantity) });
      }
      setValue("");
      await refresh();
      toast.success("بارکد به محصول افزوده شد");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "افزودن بارکد ناموفق بود");
    } finally { setBusy(false); }
  };

  return (
    <Card size="3" className="rounded-3xl md:col-span-3">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex align="center" gap="3"><Box className="card-title-icon"><TokensIcon width="20" height="20" /></Box><Box><Text as="div" weight="bold">بارکدها</Text><Text as="div" size="1" color="gray">اختیاری؛ هر محصول می‌تواند چند شناسه داشته باشد.</Text></Box></Flex>
        {canPrint && items.some((item) => item.is_active) ? <Button type="button" variant="outline" color="green" size="2" onClick={() => setPrintOpen(true)} leftIcon={<ReaderIcon />}>چاپ لیبل</Button> : null}
      </Flex>

      {canManage ? <Flex direction="column" gap="3" mt="4" className="rounded-2xl bg-[var(--gray-2)] p-4">
        <GridInputs value={value} meaning={meaning} scanQuantity={scanQuantity} packaged={Boolean(product.catalog_product?.is_packaged)} packSize={product.catalog_product?.pack_size ?? null} onValue={setValue} onMeaning={(next) => { setMeaning(next); setScanQuantity(next === "package" ? String(product.catalog_product?.pack_size ?? 1) : "1"); }} onQuantity={setScanQuantity} />
        <Flex gap="2" wrap="wrap">
          <Button type="button" intent="positive" variant="outline" color="green" disabled={!value.trim()} loading={busy} onClick={() => void add(false)} leftIcon={<PlusIcon />}>افزودن کد موجود</Button>
          <Button type="button" variant="soft" loading={busy} onClick={() => void add(true)}>ساخت بارکد تنظیم</Button>
        </Flex>
      </Flex> : null}

      <Flex direction="column" gap="2" mt="4">
        {items.some((item) => item.is_active && item.meaning === "package" && item.scan_quantity !== product.catalog_product?.pack_size) ? <Callout.Root color="amber"><Callout.Text>تعداد فعلی بسته با یکی از بارکدهای بسته متفاوت است. مقدار هر اسکن ثابت می‌ماند؛ برای تغییر، کد را آگاهانه غیرفعال و دوباره تعریف کنید.</Callout.Text></Callout.Root> : null}
        {items.length === 0 ? <Callout.Root><Callout.Text>هنوز بارکدی برای این محصول ثبت نشده است.</Callout.Text></Callout.Root> : items.map((item) => (
          <Flex key={item.id} justify="between" align="center" gap="3" className="rounded-xl border border-[var(--gray-5)] p-3">
            <Flex gap="3" align="center" className="min-w-0">
              {canManage ? <RadioGroup.Root value={items.find((entry) => entry.is_default)?.id.toString()} onValueChange={(id) => void barcodeService.setDefault(product.id, Number(id)).then(refresh)}><RadioGroup.Item value={String(item.id)} aria-label="بارکد پیش‌فرض چاپ" /></RadioGroup.Root> : null}
              <Box className="min-w-0"><Text as="div" weight="medium" className="truncate" dir="ltr">{item.value}</Text><Text as="div" size="1" color="gray">{item.meaning === "package" ? `بسته — هر اسکن ${item.scan_quantity.toLocaleString("fa-IR")} واحد` : "واحد — هر اسکن یک واحد"}</Text></Box>
              {!item.is_active ? <Badge color="gray">غیرفعال</Badge> : item.is_default ? <Badge color="violet">پیش‌فرض چاپ</Badge> : null}
            </Flex>
            {canManage && item.is_active ? <Button type="button" size="1" color="red" variant="ghost" aria-label="غیرفعال کردن بارکد" onClick={() => void barcodeService.deactivate(item.id).then(refresh)}><TrashIcon /></Button> : null}
          </Flex>
        ))}
      </Flex>
      <LabelPrintDialog open={printOpen} productIds={[product.id]} onOpenChange={setPrintOpen} />
    </Card>
  );
}

function GridInputs(props: { value: string; meaning: BarcodeMeaning; scanQuantity: string; packaged: boolean; packSize: number | null; onValue(value: string): void; onMeaning(value: BarcodeMeaning): void; onQuantity(value: string): void }) {
  return <Flex direction={{ initial: "column", sm: "row" }} gap="3">
    <label className="min-w-0 flex-1"><Text as="div" size="1" color="gray" mb="1">کد بارکد</Text><TextField.Root value={props.value} onChange={(event) => props.onValue(event.target.value)} placeholder="اسکن یا ورود دستی" dir="ltr" /></label>
    <label><Text as="div" size="1" color="gray" mb="1">معنی</Text><Select.Root value={props.meaning} onValueChange={(value) => props.onMeaning(value as BarcodeMeaning)}><Select.Trigger /><Select.Content><Select.Item value="unit">یک واحد</Select.Item><Select.Item value="package" disabled={!props.packaged}>بسته</Select.Item></Select.Content></Select.Root></label>
    {props.meaning === "package" ? <label><Text as="div" size="1" color="gray" mb="1">واحد در هر اسکن</Text><TextField.Root type="number" min="1" inputMode="numeric" value={props.scanQuantity} onChange={(event) => props.onQuantity(event.target.value)} /></label> : null}
  </Flex>;
}
