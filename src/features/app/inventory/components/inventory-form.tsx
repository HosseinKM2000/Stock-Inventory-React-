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
import { GearIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Grid, Switch, Text } from "@radix-ui/themes";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { createProductInitialValues } from "../form/product-form.initial";
import { productSchema } from "../schema/product.schema";
import { type Product } from "../types";
import { useCategories } from "@/features/setting/mutations/use-categories";

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
  const readOnly = mode === "view";
  const [displayPrice, setDisplayPrice] = useState(() =>
    formatPrice(initial?.price ?? 0),
  );

  const statusOptions = [
    { label: "موجود", value: "in_stock" },
    { label: "کمبود موجودی", value: "low_stock" },
    { label: "ناموجود", value: "out_of_stock" },
  ];

  const form = useAppForm({
    schema: productSchema,

    initialValues: createProductInitialValues(initial),

    onSubmit(values) {
      onSubmit?.({
        ...values,

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

  const handleImageChange = async (file: File | null) => {
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

  // const unitOptions = PRODUCT_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <Form isSubmitting={submitting} onSubmit={preventEventHandler(form.submit)}>
      <Box
        mt="6"
        mb="9"
        className="bg-foreground/5 border border-foreground/20 rounded-2xl p-5"
      >
        <Text size="6" weight="bold">
          {mode === "create"
            ? "افزودن محصول"
            : mode === "edit"
              ? "ویرایش محصول"
              : "مشاهده محصول"}
        </Text>

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
          <Box className="md:col-span-3">
            <ProductImageUpload
              value={imagePreview}
              onChange={handleImageChange}
              disabled={readOnly}
            />
          </Box>

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
              onChange={handlePriceChange}
              disabled={readOnly}
            />
          </FormField>

          {/* Status */}

          <FormField id="status" label="وضعیت">
            <SelectInput
              size="3"
              value={form.values.status}
              onValueChange={(value) =>
                form.setValue("status", value as Product["status"])
              }
              options={statusOptions}
              disabled={readOnly}
            />
          </FormField>

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

          {/* Note */}

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

          {/* Inventory Settings */}

          <Card
            size="3"
            className="
          md:col-span-3
          rounded-3xl
          border
          border-violet-1
          bg-violet-1/40
        "
          >
            <Flex align="center" gap="3" mb="4">
              <Box className="card-title-icon" aria-hidden="true">
                <GearIcon width="20" height="20" />
              </Box>
              <Text weight="bold">تنظیمات موجودی</Text>
            </Flex>
            <Grid columns={{ initial: "1", md: "2" }} gap="5">
              <FormField id="low_stock_threshold" label="حد نصاب هشدار">
                <TextInput
                  size="3"
                  type="number"
                  name="low_stock_threshold"
                  value={form.values.low_stock_threshold}
                  onChange={form.handleChange}
                  disabled={readOnly}
                />
              </FormField>

              <FormField id="low_stock_alert" label="فعال بودن هشدار">
                <Box pt="2">
                  <SwitchInput
                    checked={form.values.low_stock_alert}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      form.setValue("low_stock_alert", checked)
                    }
                  />
                </Box>
              </FormField>

              <FormField id="is_hidden" label="مخفی باشد">
                <Box pt="2">
                  <Switch
                    checked={form.values.is_hidden}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      form.setValue("is_hidden", checked)
                    }
                  />
                </Box>
              </FormField>
            </Grid>
          </Card>

          {/* Dates */}

          <FormField id="created_at" label="تاریخ ایجاد">
            <TextInput size="3" value={form.values.created_at} disabled />
          </FormField>

          <FormField id="updated_at" label="آخرین بروزرسانی">
            <TextInput size="3" value={form.values.updated_at} disabled />
          </FormField>
        </Grid>

        {mode !== "view" && (
          <Grid mt="6">
            <Button type="submit" loading={submitting}>
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
