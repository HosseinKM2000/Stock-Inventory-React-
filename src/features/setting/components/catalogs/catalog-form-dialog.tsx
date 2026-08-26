import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button/button";

import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { useAppForm } from "@/shared/lib/form/use-app-form";

import { ApiError } from "@/shared/api/api-error";
import { resolveAssetUrl } from "@/shared/api/client";

import type { CatalogProduct } from "../../types";

import { SelectInput } from "@/shared/ui/form/input/select-input";
import { Box, Callout, Dialog, Flex, Text } from "@radix-ui/themes";
import {
  useCreateCatalog,
  useUpdateCatalog,
} from "../../mutations/use-catalog";
import { useIndustries } from "../../mutations/use-industry";
import {
  catalogSchema,
  type CatalogFormValues,
} from "../../validators/catalog.schema";

type Props = {
  mode: "create" | "edit";
  catalogProduct?: CatalogProduct;
  trigger: ReactNode;
};

const emptyValues: CatalogFormValues = {
  name: "",
  description: "",
  brand: "",
  image_url: "",
  industry_id: 0,
};

export default function CatalogFormDialog({
  mode,
  catalogProduct,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);

  const createMutation = useCreateCatalog();
  const updateMutation = useUpdateCatalog();

  const mutation = mode === "create" ? createMutation : updateMutation;

  const {
    data: industries = [],
    isLoading: industriesLoading,
    isError,
    error,
  } = useIndustries();

  const industryItems =
    industries?.map((industry) => ({
      label: industry.name,
      value: String(industry.id),
    })) ?? [];

  const form = useAppForm({
    schema: catalogSchema,
    initialValues: emptyValues,

    onSubmit(values) {
      const payload = {
        industry_id: values.industry_id,
        name: values.name.trim(),
        description: values.description.trim() || null,
        brand: values.brand.trim() || null,
        image_url: values.image_url.trim() || null,
      };

      if (mode === "create") {
        createMutation.mutate(payload, {
          onSuccess() {
            form.reset();
            setOpen(false);
          },
        });

        return;
      }

      if (!catalogProduct) return;

      updateMutation.mutate(
        {
          id: catalogProduct.id,
          data: payload,
        },
        {
          onSuccess() {
            setOpen(false);
          },
        },
      );
    },
  });

  useEffect(() => {
    if (!open) return;

    mutation.reset();

    if (mode === "edit" && catalogProduct) {
      form.load({
        name: catalogProduct.name,
        description: catalogProduct.description ?? "",
        brand: catalogProduct.brand ?? "",
        image_url: catalogProduct.image_url ?? "",
        industry_id: catalogProduct.industry_id,
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, catalogProduct]);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  const industryErrorMessage =
    error instanceof ApiError
      ? error.message
      : isError
        ? "خطا در دریافت حوزه‌های کاری"
        : null;

  const imagePreviewUrl = resolveAssetUrl(
    form.values.image_url.trim() || undefined,
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>

      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          {mode === "create" ? "افزودن محصول کاتالوگ" : "ویرایش محصول کاتالوگ"}
        </Dialog.Title>

        {industryErrorMessage && (
          <Callout.Root color="red" mb="4">
            <Callout.Text>{industryErrorMessage}</Callout.Text>
          </Callout.Root>
        )}

        {errorMessage && (
          <Callout.Root color="red" mb="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="4">
          <FormField label="عنوان" id="catalog-name" error={form.errors.name}>
            <TextInput
              id="catalog-name"
              name="name"
              maxLength={200}
              value={form.values.name}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="توضیحات"
            id="industry-description"
            error={form.errors.description}
          >
            <TextAreaInput
              id="catalog-description"
              name="description"
              maxLength={5000}
              value={form.values.description}
              onChange={form.handleChange}
            />
          </FormField>
          <FormField label="برند" id="catalog-brand" error={form.errors.brand}>
            <TextInput
              id="catalog-brand"
              name="brand"
              maxLength={120}
              value={form.values.brand}
              onChange={form.handleChange}
            />
          </FormField>
          <FormField
            label="آدرس تصویر"
            id="catalog-image"
            error={form.errors.image_url}
          >
            <TextInput
              id="catalog-image"
              name="image_url"
              maxLength={500}
              dir="ltr"
              placeholder="https://example.com/image.webp"
              value={form.values.image_url}
              onChange={form.handleChange}
            />
            <Text as="div" size="1" color="gray" mt="1">
              آدرس تصویر را وارد کنید؛ با خالی کردن این فیلد تصویر حذف می‌شود.
            </Text>
            {imagePreviewUrl && (
              <Flex
                mt="2"
                gap="3"
                align="center"
                className="rounded-xl border border-[var(--gray-a5)] p-2"
              >
                <Box className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--gray-a3)]">
                  <img
                    src={imagePreviewUrl}
                    alt={`پیش‌نمایش ${form.values.name || "محصول"}`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </Box>
                <Button
                  size="1"
                  color="red"
                  variant="soft"
                  onClick={() => form.setValue("image_url", "")}
                >
                  حذف تصویر
                </Button>
              </Flex>
            )}
          </FormField>
          <FormField
            label="حوزه کاری"
            id="catalog-industry"
            error={form.errors.industry_id}
          >
            <SelectInput
              disabled={industriesLoading || industryItems.length === 0}
              name="industry_id"
              placeholder="انتخاب حوزه کاری"
              options={industryItems}
              value={String(form.values.industry_id)}
              onValueChange={(value) =>
                form.setValue("industry_id", Number(value))
              }
            />
          </FormField>
        </Flex>

        <Flex justify="end" gap="3" mt="6">
          <Dialog.Close>
            <Button color="gray" variant="soft">
              لغو
            </Button>
          </Dialog.Close>

          <Button
            disabled={industriesLoading || industryItems.length === 0}
            loading={mutation.isPending}
            onClick={form.submit}
          >
            {mode === "create" ? "ایجاد" : "ذخیره"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
