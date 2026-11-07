import {
  Badge,
  Box,
  Callout,
  Card,
  Flex,
  RadioGroup,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  EyeNoneIcon,
  PlusIcon,
  ReaderIcon,
  TokensIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { Product } from "@/features/app/inventory/types";
import { accessState } from "@/shared/access/access-state";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { barcodeRepository } from "../services/barcode-repository";
import { barcodeService } from "../services/barcode-service";
import type { BarcodeMeaning, ProductBarcode } from "../types";
import { LabelPrintDialog } from "./label-print-dialog";
import { BarcodeCaptureField } from "./barcode-capture-field";

type Props = { product: Product; readOnly?: boolean; tone?: "create" | "edit" };

export function BarcodeManager({ product, readOnly = false, tone = "edit" }: Props) {
  const [items, setItems] = useState<ProductBarcode[]>([]);
  const [value, setValue] = useState("");
  const [meaning, setMeaning] = useState<BarcodeMeaning>("unit");
  const [scanQuantity, setScanQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printBarcodeId, setPrintBarcodeId] = useState<number | null>(null);
  const [barcodeToDelete, setBarcodeToDelete] = useState<ProductBarcode | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const canManage =
    !readOnly &&
    accessState.canWrite() &&
    accessState.canUse("barcode.manage") &&
    accessState.hasStorePermission("barcodes.manage");
  const canPrint =
    accessState.canUse("label.print") &&
    accessState.hasStorePermission("labels.print");

  const refresh = useCallback(
    async () => setItems(await barcodeRepository.forProduct(product.id)),
    [product.id],
  );
  useEffect(() => {
    let active = true;
    void barcodeRepository.forProduct(product.id).then((next) => {
      if (active) setItems(next);
    });
    return () => {
      active = false;
    };
  }, [product.id]);

  const add = async (generate = false) => {
    setBusy(true);
    try {
      if (generate) {
        await barcodeService.generate(
          product.id,
          meaning,
          Number(scanQuantity),
        );
      } else {
        await barcodeService.create({
          productId: product.id,
          value,
          source: "manufacturer",
          meaning,
          scanQuantity: Number(scanQuantity),
        });
      }
      setValue("");
      await refresh();
      toast.success("بارکد به محصول افزوده شد");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "افزودن بارکد ناموفق بود",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeBarcode = async () => {
    if (!barcodeToDelete) return;
    setDeleting(true);
    try {
      await barcodeService.remove(barcodeToDelete.id);
      await refresh();
      setBarcodeToDelete(null);
      toast.success("بارکد حذف شد");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حذف بارکد ناموفق بود",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card size="3" className="product-barcode-card rounded-3xl md:col-span-3">
      <Flex
        justify="between"
        align="center"
        gap="3"
        wrap="wrap"
        className="product-barcode-header"
      >
        <Flex align="center" gap="3">
          <Box className="product-barcode-title-icon" aria-hidden="true">
            <TokensIcon width="24" height="24" />
          </Box>
          <Box>
            <Text as="div" size="5" weight="bold">
              بارکدها
            </Text>
            <Text as="div" size="2" color="gray">
              اختیاری؛ هر محصول می‌تواند چند شناسه داشته باشد.
            </Text>
          </Box>
        </Flex>
        {canPrint && items.some((item) => item.is_active) ? (
          <Button
            className="product-barcode-print-all"
            type="button"
            variant="outline"
            color="green"
            size="2"
            onClick={() => {
              setPrintBarcodeId(null);
              setPrintOpen(true);
            }}
            leftIcon={<ReaderIcon />}
          >
            چاپ لیبل
          </Button>
        ) : null}
      </Flex>

      {canManage ? (
        <Flex
          direction="column"
          gap="3"
          mt="4"
          className="product-barcode-composer"
        >
          <GridInputs
            value={value}
            meaning={meaning}
            scanQuantity={scanQuantity}
            packaged={Boolean(product.catalog_product?.is_packaged)}
            packSize={product.catalog_product?.pack_size ?? null}
            onValue={setValue}
            onMeaning={(next) => {
              setMeaning(next);
              setScanQuantity(
                next === "package"
                  ? String(product.catalog_product?.pack_size ?? 1)
                  : "1",
              );
            }}
            onQuantity={setScanQuantity}
            tone={tone}
          />
          <Flex direction="column" gap="2">
            <Button
              className="product-barcode-add"
              type="button"
              intent="positive"
              variant="outline"
              color="green"
              disabled={!value.trim()}
              loading={busy}
              onClick={() => void add(false)}
              leftIcon={<PlusIcon />}
            >
              افزودن کد موجود
            </Button>
            <Button
              className="product-barcode-generate"
              type="button"
              variant="soft"
              loading={busy}
              onClick={() => void add(true)}
            >
              ساخت بارکد تنظیم
            </Button>
          </Flex>
        </Flex>
      ) : null}

      <Flex direction="column" gap="2" mt="4" className="product-barcode-list">
        {items.some(
          (item) =>
            item.is_active &&
            item.meaning === "package" &&
            item.scan_quantity !== product.catalog_product?.pack_size,
        ) ? (
          <Callout.Root color="amber">
            <Callout.Text>
              تعداد فعلی بسته با یکی از بارکدهای بسته متفاوت است. مقدار هر اسکن
              ثابت می‌ماند؛ برای تغییر، کد را آگاهانه غیرفعال و دوباره تعریف
              کنید.
            </Callout.Text>
          </Callout.Root>
        ) : null}
        {items.length === 0 ? (
          <Callout.Root>
            <Callout.Text>
              هنوز بارکدی برای این محصول ثبت نشده است.
            </Callout.Text>
          </Callout.Root>
        ) : (
          items.map((item) => (
            <Flex
              key={item.id}
              align="center"
              gap="3"
              data-active={item.is_active}
              className="product-barcode-row"
            >
              <Box className="product-barcode-default-marker">
                {canManage ? (
                  <RadioGroup.Root
                    value={items
                      .find((entry) => entry.is_default)
                      ?.id.toString()}
                    onValueChange={(id) =>
                      void barcodeService
                        .setDefault(product.id, Number(id))
                        .then(refresh)
                    }
                  >
                    <RadioGroup.Item
                      value={String(item.id)}
                      aria-label="بارکد پیش‌فرض چاپ"
                    />
                  </RadioGroup.Root>
                ) : item.is_default ? (
                  <span role="img" aria-label="بارکد پیش‌فرض چاپ" />
                ) : null}
              </Box>
              <Box className="product-barcode-row-main min-w-0">
                <Text as="div" weight="bold" className="truncate" dir="ltr">
                  {item.value}
                </Text>
                <Text as="div" size="1" color="gray">
                  {item.meaning === "package"
                    ? `بسته — هر اسکن ${item.scan_quantity.toLocaleString("fa-IR")} واحد`
                    : "واحد — هر اسکن یک واحد"}
                </Text>
              </Box>
              <Flex
                gap="1"
                align="center"
                className="product-barcode-row-actions"
              >
                {!item.is_active ? (
                  <Badge size="2" color="gray">
                    غیرفعال
                  </Badge>
                ) : item.is_default ? (
                  <Badge size="2" color="violet">
                    پیش‌فرض چاپ
                  </Badge>
                ) : null}
                {canPrint && item.is_active ? (
                  <Button
                    className="product-barcode-icon-action"
                    type="button"
                    size="2"
                    color="green"
                    variant="soft"
                    aria-label={`چاپ بارکد ${item.value}`}
                    onClick={() => {
                      setPrintBarcodeId(item.id);
                      setPrintOpen(true);
                    }}
                  >
                    <ReaderIcon width="20" height="20" />
                  </Button>
                ) : null}
                {canManage && item.is_active ? (
                  <Button
                    className="product-barcode-icon-action"
                    type="button"
                    size="2"
                    color="amber"
                    variant="soft"
                    aria-label="غیرفعال کردن بارکد"
                    title="غیرفعال کردن بارکد"
                    onClick={() =>
                      void barcodeService.deactivate(item.id).then(refresh)
                    }
                  >
                    <EyeNoneIcon width="20" height="20" />
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    className="product-barcode-icon-action"
                    type="button"
                    size="2"
                    color="red"
                    variant="soft"
                    aria-label={`حذف بارکد ${item.value}`}
                    title="حذف بارکد"
                    onClick={() => setBarcodeToDelete(item)}
                  >
                    <TrashIcon width="20" height="20" />
                  </Button>
                ) : null}
              </Flex>
            </Flex>
          ))
        )}
      </Flex>
      <LabelPrintDialog
        open={printOpen}
        productIds={[product.id]}
        barcodeId={printBarcodeId}
        onOpenChange={setPrintOpen}
      />
      <ConfirmDialog
        open={barcodeToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setBarcodeToDelete(null);
        }}
        title="حذف بارکد"
        description="این بارکد از محصول حذف می‌شود و دیگر برای اسکن یا چاپ در دسترس نخواهد بود."
        details={
          barcodeToDelete ? (
            <Text as="div" dir="ltr" weight="bold">
              {barcodeToDelete.value}
            </Text>
          ) : null
        }
        confirmLabel="حذف بارکد"
        variant="danger"
        loading={deleting}
        onConfirm={() => void removeBarcode()}
      />
    </Card>
  );
}

function GridInputs(props: {
  value: string;
  meaning: BarcodeMeaning;
  scanQuantity: string;
  packaged: boolean;
  packSize: number | null;
  onValue(value: string): void;
  onMeaning(value: BarcodeMeaning): void;
  onQuantity(value: string): void;
  tone: "create" | "edit";
}) {
  return (
    <Flex
      direction={{ initial: "column", sm: "row" }}
      gap="3"
      className="product-barcode-inputs"
    >
      <Box className="min-w-0 flex-1">
        <Text as="div" size="2" weight="medium" mb="2">
          کد بارکد
        </Text>
        <BarcodeCaptureField
          value={props.value}
          onValueChange={props.onValue}
          tone={props.tone}
        />
      </Box>
      <label>
        <Text as="div" size="2" weight="medium" mb="2">
          مبنا
        </Text>
        <Select.Root
          value={props.meaning}
          onValueChange={(value) => props.onMeaning(value as BarcodeMeaning)}
        >
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="unit">یک واحد</Select.Item>
            <Select.Item value="package" disabled={!props.packaged}>
              بسته
            </Select.Item>
          </Select.Content>
        </Select.Root>
      </label>
      {props.meaning === "package" ? (
        <label>
          <Text as="div" size="2" weight="medium" mb="2">
            واحد در هر اسکن
          </Text>
          <TextField.Root
            type="number"
            min="1"
            inputMode="numeric"
            value={props.scanQuantity}
            onChange={(event) => props.onQuantity(event.target.value)}
          />
        </label>
      ) : null}
    </Flex>
  );
}
