import { ProductImageUpload } from "@/features/app/inventory/components/upload-file";
import { useAppForm } from "@/shared/lib/form/use-app-form";
import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import { useImage } from "@/shared/lib/infrastructure/media/useImage";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { SwitchInput } from "@/shared/ui/button/toggle-button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { CheckIcon, ChevronDownIcon, Cross2Icon, CubeIcon, EyeOpenIcon, GearIcon, Pencil2Icon, PlusIcon, TokensIcon } from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Checkbox, Flex, Grid, Popover, Switch, Text } from "@radix-ui/themes";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createProductInitialValues } from "../form/product-form.initial";
import { productSchema } from "../schema/product.schema";
import { type Product } from "../types";
import { useCategories } from "@/features/setting/mutations/use-categories";
import { getPackagingBreakdown, validPackSize } from "../domain/packaging";
import { useLabels } from "@/features/setting/mutations/use-labels";
import { LowStockThresholdField } from "./low-stock-threshold-field";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { BarcodeManager } from "@/features/barcode/components/barcode-manager";
import { generateInternalBarcode } from "@/features/barcode/domain/barcode";
import { barcodeRepository } from "@/features/barcode/services/barcode-repository";
import type { BarcodeMeaning, BarcodeSource } from "@/features/barcode/types";
import { accessState } from "@/shared/access/access-state";
import { formatGroupedIntegerText, normalizeIntegerText } from "../services/localized-integer";
import { BarcodeCaptureField } from "@/features/barcode/components/barcode-capture-field";
import type { Label } from "@/features/setting/types";

type ProductFormMode = "create" | "edit" | "view";
export type PendingBarcodeInput = { value: string; source: BarcodeSource; meaning: BarcodeMeaning; scanQuantity: number };

type ProductFormProps = {
  mode: ProductFormMode;

  initial?: Product;

  submitting?: boolean;

  deleting?: boolean;

  errorMessage?: string | null;

  onSubmit?(product: Product, pendingBarcodes: PendingBarcodeInput[]): void;

  onDelete?(): void;
};

export function ProductForm({
  mode,
  initial,
  submitting = false,
  errorMessage,
  onSubmit,
  onDelete,
  deleting = false,
}: ProductFormProps) {
  const { data: categories = [] } = useCategories();
  const { data: labels = [] } = useLabels();
  const readOnly = mode === "view";
  const [displaySalePrice, setDisplaySalePrice] = useState(() =>
    initial?.sale_price != null ? formatGroupedIntegerText(initial.sale_price) : initial && !initial.price_missing ? formatGroupedIntegerText(initial.price) : "",
  );
  const [displayPurchasePrice, setDisplayPurchasePrice] = useState(() =>
    initial?.purchase_price != null ? formatGroupedIntegerText(initial.purchase_price) : "",
  );
  const [pendingBarcodes, setPendingBarcodes] = useState<PendingBarcodeInput[]>([]);
  const [pendingBarcodeValue, setPendingBarcodeValue] = useState("");
  const [pendingBarcodeMeaning, setPendingBarcodeMeaning] = useState<BarcodeMeaning>("unit");
  const [actionDocked, setActionDocked] = useState(mode !== "view");
  const actionAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "view" || !actionAnchorRef.current) return;
    const anchor = actionAnchorRef.current;
    const scrollRoot = anchor.closest("main[data-scroll-restoration-id='app-shell']");
    setActionDocked(true);
    const observer = new IntersectionObserver(
      ([entry]) => setActionDocked(entry.intersectionRatio < 0.98),
      { root: scrollRoot, threshold: [0, 0.98, 1] },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [mode]);

  const form = useAppForm({
    schema: productSchema,

    initialValues: createProductInitialValues(initial),

    onSubmit(values) {
      const catalogProduct = values.catalog_product.is_packaged
        ? values.catalog_product
        : { ...values.catalog_product, pack_size: null };
      onSubmit?.({
        ...values,

        catalog_product: catalogProduct,

        image_url: values.image_url ?? null,
      }, pendingBarcodes);
    },
  });

  const imagePath =
    form.values.image_url ??
    (initial?.is_catalog_backed ? initial.catalog_product?.image_url : null) ??
    null;

  const imagePreview = useImage(imagePath);

  // Images selected in the form are staged in OPFS. Replaced staged files can
  // be removed immediately; the image referenced by the persisted product is
  // only removed by InventoryService after the metadata update succeeds.
  const stagedImages = useRef(new Set<string>());
  const imageRequest = useRef(0);

  const handleImageChange = async (file: File | null) => {
    const request = ++imageRequest.current;
    const previousPath = form.values.image_url;

    if (!file) {
      form.setValue("image_url", null);

      if (previousPath && stagedImages.current.delete(previousPath)) {
        await imageService.remove(previousPath);
      }

      return;
    }

    try {
      const path = await imageService.save(file, { purpose: "product" });

      if (request !== imageRequest.current) {
        await imageService.remove(path);
        return;
      }

      stagedImages.current.add(path);

      form.setValue("image_url", path);

      if (
        previousPath &&
        previousPath !== path &&
        stagedImages.current.delete(previousPath)
      ) {
        await imageService.remove(previousPath);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "ذخیره تصویر ناموفق بود",
      );
    }
  };

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  const packaging = form.values.catalog_product;
  const packageBreakdown =
    packaging.is_packaged && validPackSize(packaging.pack_size)
    ? getPackagingBreakdown(Number(form.values.quantity), packaging.pack_size)
    : null;
  const packagingReadOnly = readOnly || Boolean(initial?.is_catalog_backed);

  const setPackagingEnabled = (checked: boolean) => {
    form.setValue("catalog_product", {
      ...form.values.catalog_product,
      is_packaged: checked,
      pack_size: checked ? form.values.catalog_product.pack_size : null,
    });
  };

  const setPackSize = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value === "" ? null : Number(event.target.value);
    form.setValue("catalog_product", {
      ...form.values.catalog_product,
      pack_size: value,
    });
  };

  const handlePriceChange = (kind: "sale" | "purchase", event: ChangeEvent<HTMLInputElement>) => {
    const digits = normalizeIntegerText(event.target.value);

    if (!digits) {
      if (kind === "sale") {
        setDisplaySalePrice("");
        form.setValue("sale_price", null);
        form.setValue("price", 0);
      } else {
        setDisplayPurchasePrice("");
        form.setValue("purchase_price", null);
      }
      return;
    }

    const price = Number(digits);
    if (!Number.isSafeInteger(price)) return;
    if (kind === "sale") {
      setDisplaySalePrice(formatGroupedIntegerText(price));
      form.setValue("sale_price", price);
      form.setValue("price", price);
    } else {
      setDisplayPurchasePrice(formatGroupedIntegerText(price));
      form.setValue("purchase_price", price);
    }
  };
  const canViewSalePrice = accessState.hasStorePermission("products.sale_price.view");
  const canEditSalePrice = accessState.hasStorePermission("products.sale_price.change") || (mode === "create" && accessState.hasStorePermission("products.create"));
  const canViewPurchasePrice = accessState.hasStorePermission("products.purchase_price.view");
  const canEditPurchasePrice = accessState.hasStorePermission("products.purchase_price.change");

  const modeLabel = mode === "create"
    ? "افزودن محصول"
    : mode === "edit"
      ? "ویرایش محصول"
      : "مشاهده محصول";
  const ModeIcon = mode === "create" ? PlusIcon : mode === "edit" ? Pencil2Icon : EyeOpenIcon;

  return (
    <Form isSubmitting={submitting} onSubmit={preventEventHandler(form.submit)}>
      <Box
        mt="6"
        mb="9"
        data-mode={mode}
        className="product-form bg-foreground/5 border border-foreground/20 rounded-2xl p-5"
      >
        <Flex align="center" gap="3" className="product-form-heading">
          <Box className="product-form-mode-icon" aria-hidden="true">
            <ModeIcon width="22" height="22" />
          </Box>
          <Box>
            <Text as="div" size="6" weight="bold">{modeLabel}</Text>
            <Text as="div" size="2" color="gray">
              {mode === "create" ? "ثبت یک محصول تازه در موجودی" : mode === "edit" ? "به‌روزرسانی اطلاعات محصول موجود" : "اطلاعات ثبت‌شده محصول"}
            </Text>
          </Box>
        </Flex>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mt="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        {initial?.is_catalog_backed && mode !== "create" && (
          <Callout.Root color="violet" dir="rtl" mt="4">
            <Callout.Text>
              نام، توضیحات و برند این محصول از کاتالوگ دریافت می‌شود و فقط مدیر
              کاتالوگ می‌تواند آن‌ها را تغییر دهد. اطلاعات موجودی و نمایش محصول
              همچنان قابل ویرایش است.
            </Callout.Text>
          </Callout.Root>
        )}

        <Grid columns={{ initial: "1", md: "3" }} gap="5" mt="5">
          {initial?.is_catalog_backed && (
            <Card className="md:col-span-3" size="2">
              <Text as="div" weight="bold" mb="3">
                اطلاعات کاتالوگ (فقط خواندنی)
              </Text>
              <Grid columns={{ initial: "1", md: "2" }} gap="4">
                <FormField id="catalog_name" label="نام کاتالوگ">
                  <TextInput
                    size="3"
                    value={form.values.catalog_product?.name ?? ""}
                    disabled
                  />
                </FormField>
                <FormField id="brand" label="برند">
                  <TextInput
                    size="3"
                    value={form.values.catalog_product?.brand ?? ""}
                    disabled
                  />
                </FormField>
                <Box className="md:col-span-2">
                  <FormField id="catalog_description" label="توضیحات کاتالوگ">
                    <TextAreaInput
                      size="3"
                      value={form.values.catalog_product?.description ?? ""}
                      disabled
                    />
                  </FormField>
                </Box>
              </Grid>
            </Card>
          )}

          {/* Custom Label */}

          <FormField
            id="custom_label"
            label={initial?.is_catalog_backed ? "لیبل سفارشی" : "نام محصول"}
            error={form.errors.custom_label}
          >
            <TextInput
              size="3"
              name="custom_label"
              value={form.values.custom_label ?? ""}
              placeholder="نام محصول"
              onChange={form.handleChange}
              disabled={readOnly}
            />
          </FormField>

          {/* Quantity */}

          <FormField id="quantity" label="تعداد" error={form.errors.quantity}>
            <TextInput
              size="3"
              type="number"
              name="quantity"
              value={form.values.quantity}
              placeholder="۰"
              onFocus={(event) => {
                if (Number(form.values.quantity) === 0) event.currentTarget.value = "";
                else event.currentTarget.select();
              }}
              onBlur={(event) => {
                if (event.currentTarget.value === "") form.setValue("quantity", 0);
              }}
              onChange={form.handleChange}
              disabled={readOnly}
            />
          </FormField>

          {canViewSalePrice ? <FormField id="sale_price" label="قیمت (تومان)" error={form.errors.sale_price}>
            <TextInput
              id="sale_price"
              size="3"
              type="text"
              inputMode="numeric"
              name="sale_price"
              value={displaySalePrice}
              placeholder="خالی یعنی نامشخص"
              onChange={(event) => handlePriceChange("sale", event)}
              disabled={readOnly || !canEditSalePrice}
            />
          </FormField> : null}

          {canViewPurchasePrice ? <FormField id="purchase_price" label="قیمت خرید (تومان)" error={form.errors.purchase_price}>
            <TextInput
              id="purchase_price"
              size="3"
              type="text"
              inputMode="numeric"
              name="purchase_price"
              value={displayPurchasePrice}
              placeholder="خالی یعنی نامشخص"
              onChange={(event) => handlePriceChange("purchase", event)}
              disabled={readOnly || !canEditPurchasePrice}
            />
          </FormField> : null}

          <FormField id="category_id" label="دسته‌بندی">
            <SelectInput
              size="3"
              value={form.values.category_id == null ? "none" : String(form.values.category_id)}
              onValueChange={(value) => form.setValue("category_id", value === "none" ? null : Number(value))}
              options={[{ label: "بدون دسته‌بندی", value: "none" }, ...categoryOptions]}
              disabled={readOnly}
            />
          </FormField>

          <Box className="md:col-span-3">
            <FormField id="note" label="یادداشت">
              <TextAreaInput
                size="3"
                name="note"
                value={form.values.note ?? ""}
                onChange={form.handleChange}
                disabled={readOnly}
              />
            </FormField>
          </Box>

          {initial && (
            <>
              <FormField id="created_at" label="تاریخ ایجاد">
                <TextInput size="3" value={formatJalaliDateTime(form.values.created_at)} disabled />
              </FormField>
              <FormField id="updated_at" label="آخرین بروزرسانی">
                <TextInput size="3" value={formatJalaliDateTime(form.values.updated_at)} disabled />
              </FormField>
            </>
          )}

          <Box className="md:col-span-3">
            <ProductImageUpload
              value={imagePreview}
              onChange={handleImageChange}
              disabled={readOnly}
            />
          </Box>

          <Box className="md:col-span-3">
            <FormField id="label_ids" label="برچسب‌ها">
              {labels.length === 0 ? (
                <Text size="2" color="gray">از بخش ابزارها، برچسب‌های مورد نیاز را بسازید.</Text>
              ) : (
                <ProductLabelsSelect
                  labels={labels}
                  selectedIds={form.values.label_ids}
                  disabled={readOnly}
                  onChange={(next) => form.setValue("label_ids", next)}
                />
              )}
            </FormField>
          </Box>

          <Box className="product-form-configurations md:col-span-3">
            <Text as="div" size="3" weight="bold" mb="3">پیکربندی محصول</Text>
            <Grid columns={{ initial: "1", lg: "3" }} gap="4" align="stretch">
              <Card size="3" className="product-form-config-card rounded-3xl">
                <Flex align="center" gap="3" mb="4">
                  <Box className="card-title-icon" aria-hidden="true"><CubeIcon width="20" height="20" /></Box>
                  <Text weight="bold">بسته‌بندی</Text>
                </Flex>
                <Flex direction="column" gap="4">
                  <FormField id="is_packaged" label="محصول به‌صورت بسته‌ای عرضه می‌شود؟">
                    <Box pt="2">
                      <SwitchInput checked={packaging.is_packaged} disabled={packagingReadOnly} onCheckedChange={setPackagingEnabled} />
                    </Box>
                  </FormField>
                  {packaging.is_packaged && (
                    <FormField id="pack_size" label="تعداد در هر بسته" error={!validPackSize(packaging.pack_size) ? "یک عدد صحیح بزرگ‌تر از صفر وارد کنید" : undefined}>
                      <TextInput id="pack_size" type="number" min="1" step="1" inputMode="numeric" value={packaging.pack_size ?? ""} placeholder="برای نمونه: ۱۲" onChange={setPackSize} disabled={packagingReadOnly} />
                    </FormField>
                  )}
                  {packageBreakdown && (
                    <Flex direction="column" gap="1">
                      <Text size="2"><Text color="gray">بسته کامل: </Text>{packageBreakdown.completePackages.toLocaleString("fa-IR")}</Text>
                      <Text size="2"><Text color="gray">تعداد کل: </Text>{Number(form.values.quantity).toLocaleString("fa-IR")}</Text>
                      {packageBreakdown.remainingUnits > 0 && <Text size="2" color="amber">واحد باقی‌مانده: {packageBreakdown.remainingUnits.toLocaleString("fa-IR")}</Text>}
                    </Flex>
                  )}
                </Flex>
              </Card>

              <Card size="3" className="product-form-config-card rounded-3xl">
                <Flex align="center" gap="3" mb="4">
                  <Box className="card-title-icon" aria-hidden="true"><EyeOpenIcon width="20" height="20" /></Box>
                  <Text weight="bold">نمایش محصول</Text>
                </Flex>
                <FormField id="is_hidden" label="محصول از فهرست مخفی باشد؟">
                  <Box pt="2">
                    <Switch checked={form.values.is_hidden} disabled={readOnly} onCheckedChange={(checked) => form.setValue("is_hidden", checked)} />
                  </Box>
                </FormField>
              </Card>

              <Card size="3" className="product-form-config-card rounded-3xl">
                <Flex align="center" gap="3" mb="4">
                  <Box className="card-title-icon" aria-hidden="true"><GearIcon width="20" height="20" /></Box>
                  <Text weight="bold">هشدار کمبود موجودی</Text>
                </Flex>
                <Flex direction="column" gap="4">
                  <FormField id="low_stock_alert" label="هشدار فعال باشد؟">
                    <Box pt="2">
                      <SwitchInput checked={form.values.low_stock_alert} disabled={readOnly} onCheckedChange={(checked) => form.setValue("low_stock_alert", checked)} />
                    </Box>
                  </FormField>
                  <LowStockThresholdField value={form.values.low_stock_threshold} disabled={readOnly} error={form.errors.low_stock_threshold} onValueChange={(value) => form.setValue("low_stock_threshold", Number(value || 0))} />
                </Flex>
              </Card>
            </Grid>
          </Box>

          {initial ? <BarcodeManager product={initial} readOnly={readOnly} tone="edit" /> : (
            <Card size="3" className="product-barcode-card rounded-3xl md:col-span-3">
              <Flex align="center" gap="3" className="product-barcode-header">
                <Box className="product-barcode-title-icon" aria-hidden="true"><TokensIcon width="24" height="24" /></Box>
                <Box>
                  <Text as="div" size="5" weight="bold">بارکدها</Text>
                  <Text as="div" size="2" color="gray">اختیاری؛ هر محصول می‌تواند چند شناسه داشته باشد.</Text>
                </Box>
              </Flex>
              <Box mt="4" className="product-barcode-composer">
                <Grid columns={{ initial: "1", sm: "2" }} gap="3" className="product-barcode-inputs">
                  <Box>
                    <Text as="div" size="2" weight="medium" mb="2">کد بارکد</Text>
                    <BarcodeCaptureField value={pendingBarcodeValue} onValueChange={setPendingBarcodeValue} placeholder="اسکن یا ورود دستی" tone="create" />
                  </Box>
                  <Box>
                    <Text as="div" size="2" weight="medium" mb="2">مبنا</Text>
                    <SelectInput value={pendingBarcodeMeaning} onValueChange={(next) => setPendingBarcodeMeaning(next as BarcodeMeaning)} options={[{ label: "یک واحد", value: "unit" }, { label: "یک بسته", value: "package" }]} />
                  </Box>
                </Grid>
                <Flex direction="column" gap="2" mt="3">
                  <Button className="product-barcode-add" type="button" variant="outline" color="green" disabled={!pendingBarcodeValue.trim()} onClick={() => {
                    const scanQuantity = pendingBarcodeMeaning === "package" ? Number(packaging.pack_size) : 1;
                    if (!Number.isSafeInteger(scanQuantity) || scanQuantity < 1) return toast.error("ابتدا تعداد واحد هر بسته را مشخص کنید");
                    setPendingBarcodes((current) => [...current, { value: pendingBarcodeValue, source: "manufacturer", meaning: pendingBarcodeMeaning, scanQuantity }]);
                    setPendingBarcodeValue("");
                  }} leftIcon={<PlusIcon />}>افزودن کد موجود</Button>
                  <Button className="product-barcode-generate" type="button" variant="soft" onClick={() => void generateInternalBarcode({ exists: async (candidate) => (await barcodeRepository.findByValue(candidate)).length > 0 }).then((generated) => {
                    const scanQuantity = pendingBarcodeMeaning === "package" ? Number(packaging.pack_size) : 1;
                    if (!Number.isSafeInteger(scanQuantity) || scanQuantity < 1) return toast.error("ابتدا تعداد واحد هر بسته را مشخص کنید");
                    setPendingBarcodes((current) => [...current, { value: generated, source: "tanzim", meaning: pendingBarcodeMeaning, scanQuantity }]);
                  })}>ساخت بارکد تنظیم</Button>
                </Flex>
              </Box>
              {pendingBarcodes.length ? <Flex direction="column" gap="2" mt="4" className="product-barcode-list">{pendingBarcodes.map((item, index) => <Flex key={`${item.value}-${index}`} justify="between" align="center" gap="3" className="product-barcode-row product-barcode-row--pending"><Box className="product-barcode-row-main"><Text as="div" weight="bold" dir="ltr">{item.value}</Text><Text as="div" size="1" color="gray">{item.meaning === "package" ? `بسته — هر اسکن ${item.scanQuantity.toLocaleString("fa-IR")} واحد` : "واحد — هر اسکن یک واحد"}</Text></Box><Button className="product-barcode-pending-remove" type="button" size="2" color="red" variant="soft" aria-label={`برداشتن بارکد ${item.value} از فرم`} onClick={() => setPendingBarcodes((current) => current.filter((_, currentIndex) => currentIndex !== index))}>برداشتن</Button></Flex>)}</Flex> : null}
            </Card>
          )}

        </Grid>

        {mode !== "view" && (
          <Grid mt="6" className="product-form-actions">
            <div ref={actionAnchorRef} className="product-form-action-anchor" aria-hidden="true" />
            <Button
              type="submit"
              loading={submitting}
              aria-label={mode === "create" ? "ثبت محصول" : "ثبت تغییرات"}
              data-floating={actionDocked}
              className="product-form-primary-action"
            >
              {actionDocked ? <CheckIcon width="22" height="22" aria-hidden="true" /> : mode === "create" ? "ثبت محصول" : "ثبت تغییرات"}
            </Button>

            {mode === "edit" && onDelete && (
              <Button
                mt="3"
                color="red"
                type="button"
                loading={deleting}
                disabled={initial?.is_catalog_backed}
                title={
                  initial?.is_catalog_backed
                    ? "محصولات کاتالوگی قابل حذف نیستند؛ از گزینه مخفی کردن استفاده کنید."
                    : undefined
                }
                onClick={onDelete}
              >
                {initial?.is_catalog_backed ? "محصول کاتالوگی قابل حذف نیست" : "حذف"}
              </Button>
            )}
          </Grid>
        )}
      </Box>
    </Form>
  );
}

function ProductLabelsSelect({ labels, selectedIds, disabled, onChange }: {
  labels: Label[];
  selectedIds: number[];
  disabled: boolean;
  onChange(ids: number[]): void;
}) {
  const selected = labels.filter((label) => selectedIds.includes(label.id));
  const toggle = (id: number) => onChange(
    selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id],
  );

  return (
    <Box className="product-label-select">
      <Popover.Root>
        <Popover.Trigger>
          <Button
            type="button"
            variant="surface"
            color="gray"
            disabled={disabled}
            className="product-label-select-trigger"
            aria-label="انتخاب برچسب‌های محصول"
          >
            <span>{selected.length ? `${selected.length.toLocaleString("fa-IR")} برچسب انتخاب شده` : "انتخاب برچسب‌ها"}</span>
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        </Popover.Trigger>
        <Popover.Content dir="rtl" width="min(360px, calc(100vw - 2rem))">
          <Flex direction="column" gap="1" className="max-h-64 overflow-y-auto">
            {labels.map((label) => (
              <Text as="label" key={label.id} size="2" className="product-label-option">
                <Checkbox checked={selectedIds.includes(label.id)} onCheckedChange={() => toggle(label.id)} />
                <span>{label.name}</span>
              </Text>
            ))}
          </Flex>
        </Popover.Content>
      </Popover.Root>
      {selected.length ? (
        <Flex gap="2" wrap="wrap" mt="2" className="product-label-selected" aria-label="برچسب‌های انتخاب‌شده">
          {selected.map((label) => (
            <Badge key={label.id} size="2" variant="soft" color="violet">
              {label.name}
              {!disabled ? (
                <button type="button" aria-label={`حذف برچسب ${label.name}`} onClick={() => toggle(label.id)}>
                  <Cross2Icon />
                </button>
              ) : null}
            </Badge>
          ))}
        </Flex>
      ) : null}
    </Box>
  );
}
