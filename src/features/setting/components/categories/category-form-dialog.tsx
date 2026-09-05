import { useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button/button";
import { Callout, Dialog, Flex } from "@radix-ui/themes";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";

import { ApiError } from "@/shared/api/api-error";
import type { Category, CategoryInput } from "../../types";

import {
  useCreateCategory,
  useUpdateCategory,
} from "../../mutations/use-categories";

import { useAppForm } from "@/shared/lib/form/use-app-form";
import { categorySchema } from "../../validators/category.schema";

type Props = {
  mode: "create" | "edit";
  category?: Category;
  trigger: ReactNode;
};

const emptyForm: CategoryInput = {
  name: "",
  description: "",
};

const CategoryFormDialog = ({ mode, category, trigger }: Props) => {
  const [open, setOpen] = useState(false);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const mutation = mode === "create" ? createMutation : updateMutation;

  const form = useAppForm({
    schema: categorySchema,

    initialValues: emptyForm,

    onSubmit(values) {
      const payload: CategoryInput = {
        name: values.name,
        description: values.description ?? "",
      };

      if (mode === "create") {
        createMutation.mutate(payload, {
          onSuccess() {
            setOpen(false);
            form.reset();
          },
        });

        return;
      }

      if (!category) return;

      updateMutation.mutate(
        {
          id: category.id,
          data: payload,
        },
        {
          onSuccess() {
            setOpen(false);
            form.reset();
          },
        },
      );
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      return;
    }

    mutation.reset();

    if (mode === "edit" && category) {
      form.load({
        name: category.name,
        description: category.description ?? "",
      });

      return;
    }

    form.reset();
  }

  const errorMessage =
    mutation.error instanceof ApiError ? mutation.error.message : null;

  const accent = mode === "create" ? "violet" : "amber";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title color={accent}>
          {mode === "create" ? "افزودن دسته بندی" : "ویرایش دسته بندی"}
        </Dialog.Title>

        <Dialog.Description size="2" mb="4" />

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mb="3">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="3">
          <FormField label="عنوان" id="category-name" error={form.errors.name}>
            <TextInput
              name="name"
              size="3"
              value={form.values.name}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="توضیحات"
            id="category-description"
            error={form.errors.description}
          >
            <TextAreaInput
              name="description"
              size="3"
              value={form.values.description ?? ""}
              onChange={form.handleChange}
            />
          </FormField>
        </Flex>

        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              لغو
            </Button>
          </Dialog.Close>

          <Button
            color={accent}
            variant="surface"
            loading={mutation.isPending}
            onClick={form.submit}
          >
            {mode === "create" ? "افزودن" : "ویرایش"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default CategoryFormDialog;
