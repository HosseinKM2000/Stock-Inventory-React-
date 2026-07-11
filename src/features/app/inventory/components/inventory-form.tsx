import { ProductImageUpload } from "@/features/app/inventory/components/upload-file";
import { useCategories } from "@/features/setting/mutations/use-categories";
import { resolveAssetUrl } from "@/shared/api/client";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { BellIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Grid, Switch, Text } from "@radix-ui/themes";
import { useState } from "react";
import { PRODUCT_UNITS, type Product, type ProductInput } from "../types";

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
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | undefined>(
    initial?.category_id != null ? String(initial.category_id) : undefined,
  );
  const [unit, setUnit] = useState<string | undefined>(
    initial?.unit ?? undefined,
  );
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [threshold, setThreshold] = useState(
    String(initial?.low_stock_threshold ?? ""),
  );
  const [lowStockAlert, setLowStockAlert] = useState(
    initial?.low_stock_alert ?? false,
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    resolveAssetUrl(initial?.image_url),
  );
  const [removeImage, setRemoveImage] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);

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

  const submit = () => {
    if (!name.trim()) {
      setNameError("نام محصول الزامی است");
      return;
    }
    setNameError(null);

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      unit: unit ?? null,
      quantity: Number(quantity) || 0,
      price: Number(price) || 0,
      low_stock_threshold: Number(threshold) || 0,
      low_stock_alert: lowStockAlert,
      category_id: categoryId ? Number(categoryId) : null,
      image: imageFile ?? undefined,
      remove_image: mode === "edit" ? removeImage : undefined,
    });
  };

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));
  const unitOptions = PRODUCT_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <Form onSubmit={preventEventHandler(submit)} isSubmitting={submitting}>
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
          <FormField label="نام محصول" id="name" error={nameError ?? undefined}>
            <TextInput
              size={"3"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="دسته بندی" id="category">
            <SelectInput
              size={"3"}
              placeholder="دسته بندی محصول"
              value={categoryId}
              onValueChange={setCategoryId}
              options={categoryOptions}
            />
          </FormField>
          <FormField label="واحد" id="unit">
            <SelectInput
              size={"3"}
              placeholder="واحد محصول"
              value={unit}
              onValueChange={setUnit}
              options={unitOptions}
            />
          </FormField>
          <FormField label="تعداد" id="quantity">
            <TextInput
              size={"3"}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </FormField>
          <FormField label="قیمت (تومان)" id="price">
            <TextInput
              size={"3"}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </FormField>
          <Box className="md:col-span-3">
            <FormField id="description" label="توضیحات">
              <TextAreaInput
                size="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
            <Flex
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
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </FormField>
              </Box>
            </Flex>
          </Card>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button type="submit" loading={submitting}>
            {mode === "create" ? "افزودن" : "ثبت تغییرات"}
          </Button>
          {mode === "edit" && onDelete && (
            <Button
              type="button"
              color="red"
              mt={"3"}
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
