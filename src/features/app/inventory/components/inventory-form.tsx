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
import { CubeIcon, EyeOpenIcon, GearIcon, Pencil2Icon, PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Grid, Switch, Text } from "@radix-ui/themes";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { createProductInitialValues } from "../form/product-form.initial";
import { productSchema } from "../schema/product.schema";
import { type Product } from "../types";
import { useCategories } from "@/features/setting/mutations/use-categories";
import { getPackagingBreakdown, validPackSize } from "../domain/packaging";
import { useLabels } from "@/features/setting/mutations/use-labels";
import { LowStockThresholdField } from "./low-stock-threshold-field";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";

type ProductFormMode = "create" | "edit" | "view";

const priceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

function normalizePriceDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
}

function formatPrice(value: number) {
  return Number.isFinite(value) ? priceFormatter.format(value) : "";
}

type ProductFormProps = {
  mode: ProductFormMode;

  initial?: Product;

  submitting?: boolean;

  deleting?: boolean;

  errorMessage?: string | null;

  onSubmit?(product: Product): void;

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
  const [displayPrice, setDisplayPrice] = useState(() =>
    initial ? formatPrice(initial.price) : "",
  );

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
      });
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

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = normalizePriceDigits(event.target.value);

    if (!digits) {
      setDisplayPrice("");
      form.setValue("price", 0);
      return;
    }

    const price = Number(digits);
    setDisplayPrice(formatPrice(price));
    form.setValue("price", price);
  };

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
              onFocus={(event) => event.currentTarget.select()}
              onChange={form.handleChange}
              disabled={readOnly}
            />
          </FormField>

          {/* Price */}

          <FormField id="price" label="قیمت (تومان)" error={form.errors.price}>
            <TextInput
              id="price"
              size="3"
              type="text"
              inputMode="numeric"
              name="price"
              value={displayPrice}
              placeholder="برای نمونه: ۱۰۰٬۰۰۰"
              onChange={handlePriceChange}
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

          <FormField id="category_id" label="دسته‌بندی">
            <SelectInput
              size="3"
              value={
                form.values.category_id == null
                  ? "none"
                  : String(form.values.category_id)
              }
              onValueChange={(value) =>
                form.setValue(
                  "category_id",
                  value === "none" ? null : Number(value),
                )
              }
              options={[
                { label: "بدون دسته‌بندی", value: "none" },
                ...categoryOptions,
              ]}
              disabled={readOnly}
            />
          </FormField>

          <Box className="md:col-span-2">
            <FormField id="label_ids" label="برچسب‌ها">
              {labels.length === 0 ? (
                <Text size="2" color="gray">از بخش ابزارها، برچسب‌های مورد نیاز را بسازید.</Text>
              ) : (
                <Flex gap="2" wrap="wrap" mt="2">
                  {labels.map((label) => {
                    const checked = form.values.label_ids.includes(label.id);
                    return (
                      <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-5 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={readOnly}
                          onChange={() => form.setValue("label_ids", checked
                            ? form.values.label_ids.filter((id) => id !== label.id)
                            : [...form.values.label_ids, label.id])}
                        />
                        <Text size="2">{label.name}</Text>
                      </label>
                    );
                  })}
                </Flex>
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

        </Grid>

        {mode !== "view" && (
          <Grid mt="6" className="product-form-actions">
            <Button intent="positive" type="submit" loading={submitting} className="product-form-primary-action">
              {mode === "create" ? "افزودن" : "ثبت تغییرات"}
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
