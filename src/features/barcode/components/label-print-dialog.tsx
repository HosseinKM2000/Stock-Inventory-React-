import { Callout, Dialog, Flex, Grid, Select, Switch, Text, TextField } from "@radix-ui/themes";
import { ReaderIcon } from "@radix-ui/react-icons";
import { useEffect, useMemo, useState } from "react";

import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import { accessState } from "@/shared/access/access-state";
import { Button } from "@/shared/ui/button/button";
import { browserPrintTransport, downloadPrintableLabels } from "../labels/browser-printer";
import { renderLabelDocument, type LabelItem } from "../labels/label-renderer";
import { labelProfileStore } from "../labels/label-profiles";
import type { LabelProfile, ProductBarcode } from "../types";
import { barcodeRepository } from "../services/barcode-repository";

type Props = { open: boolean; productIds: number[]; onOpenChange(open: boolean): void };

export function LabelPrintDialog({ open, productIds, onOpenChange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [copies, setCopies] = useState<Record<number, number>>({});
  const [profiles, setProfiles] = useState(() => labelProfileStore.all());
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [renderedPreview, setRenderedPreview] = useState<{ key: string; html: string; error: string | null } | null>(null);
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];

  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([
      Promise.all(productIds.map((id) => inventoryRepository.get(id))),
      barcodeRepository.getAll(),
    ]).then(([records, codes]) => {
      if (!active) return;
      setProducts(records.filter((item): item is Product => Boolean(item)));
      setBarcodes(codes.filter((item) => item.is_active));
      setCopies(Object.fromEntries(productIds.map((id) => [id, 1])));
    });
    return () => { active = false; };
  }, [open, productIds]);

  const items = useMemo<LabelItem[]>(() => products.flatMap((product) => {
    const choices = barcodes.filter((item) => item.product_id === product.id);
    const barcode = choices.find((item) => item.is_default) ?? choices[0];
    return barcode ? [{ product, barcode, copies: copies[product.id] ?? 1 }] : [];
  }), [barcodes, copies, products]);
  const missing = products.length - items.length;

  const saveProfile = (patch: Partial<LabelProfile>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    if (next.widthMm < 20 || next.heightMm < 15 || next.columns < 1 || next.columns > 6) return;
    setProfiles(labelProfileStore.save(next));
  };

  const previewKey = profile ? JSON.stringify({ profile, items: items.map((item) => [item.product.id, item.barcode.id, item.copies]) }) : "";
  const preview = renderedPreview?.key === previewKey ? renderedPreview : { html: "", error: null as string | null };
  useEffect(() => {
    if (!profile || items.length === 0) return;
    let active = true;
    void renderLabelDocument(items, profile).then((html) => {
      if (active) setRenderedPreview({ key: previewKey, html, error: null });
    }).catch((reason) => {
      if (active) setRenderedPreview({ key: previewKey, html: "", error: reason instanceof Error ? reason.message : "ساخت پیش‌نمایش ناموفق بود" });
    });
    return () => { active = false; };
  }, [items, previewKey, profile]);

  const print = () => {
    accessState.requireCapability("label.print");
    accessState.requireStorePermission("labels.print");
    if (!preview.html) return;
    browserPrintTransport.print(preview.html);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="900px" dir="rtl">
        <Dialog.Title weight="bold">چاپ لیبل محصولات</Dialog.Title>
        <Dialog.Description color="gray">تعداد نسخه، اندازه واقعی و محتوای لیبل را پیش از چاپ بررسی کنید.</Dialog.Description>
        <Grid columns={{ initial: "1", md: "2" }} gap="5" mt="5">
          <Flex direction="column" gap="4">
            <label><Text as="div" size="2" weight="medium" mb="1">پروفایل لیبل</Text>
              <Select.Root value={profileId} onValueChange={setProfileId}><Select.Trigger className="w-full" /><Select.Content>{profiles.map((item) => <Select.Item key={item.id} value={item.id}>{item.name}</Select.Item>)}</Select.Content></Select.Root>
            </label>
            {profile ? <Grid columns="2" gap="3">
              <label><Text size="1" color="gray">عرض (میلی‌متر)</Text><TextField.Root type="number" min="20" value={profile.widthMm} onChange={(event) => saveProfile({ widthMm: Number(event.target.value) })} /></label>
              <label><Text size="1" color="gray">ارتفاع (میلی‌متر)</Text><TextField.Root type="number" min="15" value={profile.heightMm} onChange={(event) => saveProfile({ heightMm: Number(event.target.value) })} /></label>
              <label><Text size="1" color="gray">حاشیه (میلی‌متر)</Text><TextField.Root type="number" min="0" value={profile.marginMm} onChange={(event) => saveProfile({ marginMm: Number(event.target.value) })} /></label>
              {profile.kind === "a4" ? <label><Text size="1" color="gray">ستون‌ها</Text><TextField.Root type="number" min="1" max="6" value={profile.columns} onChange={(event) => saveProfile({ columns: Number(event.target.value) })} /></label> : null}
              {profile.kind === "a4" ? <label><Text size="1" color="gray">فاصله افقی</Text><TextField.Root type="number" min="0" value={profile.horizontalGapMm} onChange={(event) => saveProfile({ horizontalGapMm: Number(event.target.value) })} /></label> : null}
              {profile.kind === "a4" ? <label><Text size="1" color="gray">فاصله عمودی</Text><TextField.Root type="number" min="0" value={profile.verticalGapMm} onChange={(event) => saveProfile({ verticalGapMm: Number(event.target.value) })} /></label> : null}
            </Grid> : null}
            {profile ? <Flex gap="4" wrap="wrap">
              <Text as="label" size="2" className="flex items-center gap-2"><Switch checked={profile.showPrice} onCheckedChange={(value) => saveProfile({ showPrice: value })} /> قیمت</Text>
              <Text as="label" size="2" className="flex items-center gap-2"><Switch checked={profile.showPackageQuantity} onCheckedChange={(value) => saveProfile({ showPackageQuantity: value })} /> تعداد بسته</Text>
            </Flex> : null}
            <Flex direction="column" gap="2">
              {products.map((product) => <Flex key={product.id} align="center" justify="between" gap="3" className="rounded-xl border border-[var(--gray-5)] p-3">
                <Text size="2" weight="medium">{product.custom_label || product.catalog_product?.name || "محصول"}</Text>
                <TextField.Root aria-label="تعداد نسخه" type="number" inputMode="numeric" min="1" max="100" className="w-20" value={copies[product.id] ?? 1} onChange={(event) => setCopies((current) => ({ ...current, [product.id]: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} />
              </Flex>)}
            </Flex>
            {missing > 0 ? <Callout.Root color="amber"><Callout.Text>{missing.toLocaleString("fa-IR")} محصول بارکد فعال ندارد و چاپ نمی‌شود.</Callout.Text></Callout.Root> : null}
            {preview.error ? <Callout.Root color="red"><Callout.Text>{preview.error}</Callout.Text></Callout.Root> : null}
          </Flex>
          <iframe title="پیش‌نمایش لیبل" srcDoc={preview.html} className="h-[480px] w-full rounded-2xl border border-[var(--gray-5)] bg-white" />
        </Grid>
        <Text as="div" size="1" color="gray" mt="4">در پنجره چاپ، مقیاس را روی ۱۰۰٪ یا Actual size بگذارید و Header/Footer مرورگر را خاموش کنید. بسته‌شدن پنجره چاپ به معنی موفقیت چاپ نیست.</Text>
        <Flex justify="end" gap="3" mt="5">
          <Dialog.Close><Button color="gray" variant="soft">بستن</Button></Dialog.Close>
          <Button variant="soft" disabled={!preview.html} onClick={() => downloadPrintableLabels(preview.html)}>دریافت فایل چاپی</Button>
          <Button intent="positive" color="green" variant="outline" disabled={!preview.html} onClick={print} leftIcon={<ReaderIcon />}>بازکردن چاپ</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
