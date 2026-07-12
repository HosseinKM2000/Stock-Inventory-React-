import { useState } from "react";
import { Form } from "@/shared/ui/form/form";
import { Button } from "@/shared/ui/button/button";
import { resolveAssetUrl } from "@/shared/api/client";
import { productSchema } from "../schema/product.schema";
import { type Product, type ProductInput } from "../types";
import { useAppForm } from "@/shared/lib/form/use-app-form";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { Box, Callout, Card, Grid, Text } from "@radix-ui/themes";
import { ProductImageUpload } from "@/features/app/inventory/components/upload-file";

type ProductFormProps = {
  mode: "create" | "edit";
  initial?: Product;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (input: ProductInput) => void;
  onDelete?: () => void;
  deleting?: boolean;
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
  // const { data: categories = [] } = useCategories();

  const form = useAppForm({
    schema: productSchema,

    initialValues: {
      name: initial?.catalog_product?.name ?? "",

      description: initial?.catalog_product?.description ?? null,

      // unit: initial?.unit ?? null,

      quantity: initial?.quantity ?? 0,

      price: initial?.price ?? 0,

      low_stock_threshold: initial?.low_stock_threshold ?? 0,

      low_stock_alert: initial?.low_stock_alert ?? false,

      image: null,

      remove_image: false,
    },

    onSubmit(values) {
      onSubmit({
        ...values,

        image: imageFile ?? undefined,

        remove_image: mode === "edit" ? removeImage : undefined,
      });
    },
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    resolveAssetUrl(initial?.catalog_product?.image_url),
  );
  const [removeImage, setRemoveImage] = useState(false);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    } else {
      setImagePreview(undefined);
      setRemoveImage(true);
    }
  };

  // const categoryOptions = categories.map((c) => ({
  //   value: String(c.id),
  //   label: c.name,
  // }));
  // const unitOptions = PRODUCT_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <Form isSubmitting={submitting} onSubmit={preventEventHandler(form.submit)}>
      <Box
        mt={"6"}
        mb={"9"}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">
          {mode === "create" ? "افزودن محصول جدید" : "ویرایش محصول"}
        </Text>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mt="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Grid columns={{ xs: "1", md: "3" }} gap={"5"} width="auto" mt={"5"}>
          <Box className="md:col-span-3">
            <ProductImageUpload
              value={imagePreview}
              onChange={handleImageChange}
            />
          </Box>
          <FormField label="نام محصول" id="name" error={form.errors.name}>
            <TextInput
              size={"3"}
              name="name"
              value={form.values.name}
              onChange={form.handleChange}
            />
          </FormField>
          {/* <FormField label="دسته بندی" id="category_id">
            <SelectInput
              size={"3"}
              placeholder="دسته بندی محصول"
              value={`${form.values.category_id}`}
              onValueChange={(value) =>
                form.setValue("category_id", Number(value))
              }
              options={categoryOptions}
            />
          </FormField> */}
          {/* <FormField label="واحد" id="unit">
            <SelectInput
              value={form.values.unit ?? ""}
              onValueChange={(value) => form.setValue("unit", value)}
              options={unitOptions}
            />
          </FormField> */}
          <FormField label="تعداد" id="quantity">
            <TextInput
              size={"3"}
              type="number"
              name="quantity"
              value={form.values.quantity}
              onChange={form.handleChange}
            />
          </FormField>
          <FormField label="قیمت (تومان)" id="price">
            <TextInput
              size={"3"}
              type="number"
              name="price"
              value={form.values.price}
              onChange={form.handleChange}
            />
          </FormField>
          <Box className="md:col-span-3">
            <FormField id="description" label="توضیحات">
              <TextAreaInput
                size="3"
                name="description"
                value={form.values.description ?? ""}
                onChange={form.handleChange}
              />
            </FormField>
          </Box>
          <Card
            size="3"
            className="
        w-full
        rounded-3xl
        border
        md:col-span-3
        border-violet-1
        bg-violet-1/40
      "
          >
            {/* <Flex
              gap="3"
              wrap={"wrap"}
              width={"100%"}
              align={"center"}
              justify={"between"}
            >
              <Flex justify="between" wrap={"wrap"} align="start" gap="4">
                <Switch
                  size="3"
                  checked={lowStockAlert}
                  onCheckedChange={setLowStockAlert}
                />
                <Flex align="start" gap="3" wrap={"wrap"}>
                  <Box className="mt-1 text-amber-600">
                    <BellIcon width={28} height={28} />
                  </Box>
                  <Box>
                    <Text as="div" size="3" weight="bold">
                      هشدار کم موجودی
                    </Text>
                    <Text as="div" size="2" color="gray" className="mt-1">
                      هنگام رسیدن موجودی به حد نصاب اطلاع‌رسانی شود.
                    </Text>
                  </Box>
                </Flex>
              </Flex>
              <Box className="w-full md:w-45">
                <FormField id="threshold" label="حد نصاب هشدار">
                  <TextInput
                    size="3"
                    type="number"
                    value={form.values.t}
                    onChange={form.handleChange}
                  />
                </FormField>
              </Box>
            </Flex> */}
          </Card>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "افزودن" : "ثبت تغییرات"}
          </Button>
          {mode === "edit" && onDelete && (
            <Button
              mt={"3"}
              color="red"
              type="button"
              loading={deleting}
              onClick={onDelete}
            >
              حذف
            </Button>
          )}
        </Grid>
      </Box>
    </Form>
  );
}
