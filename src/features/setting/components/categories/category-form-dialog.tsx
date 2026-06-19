import {
  useCreateCategory,
  useUpdateCategory,
} from "@/features/categories/use-categories";
import type { Category } from "@/features/categories/types";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Callout, Dialog, Flex } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";

type CategoryFormDialogProps = {
  mode: "create" | "edit";
  category?: Category;
  trigger: ReactNode;
};

const CategoryFormDialog = ({
  mode,
  category,
  trigger,
}: CategoryFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const mutation = mode === "create" ? createCategory : updateCategory;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
      mutation.reset();
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: description.trim() || null };

    if (mode === "create") {
      createCategory.mutate(data, { onSuccess: () => setOpen(false) });
    } else if (category) {
      updateCategory.mutate(
        { id: category.id, data },
        { onSuccess: () => setOpen(false) },
      );
    }
  };

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
        <Dialog.Description size="2" mb="4"></Dialog.Description>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mb="3">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="3">
          <FormField label="عنوان" id="category-name">
            <TextInput
              size={"3"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="توضیحات" id="category-description">
            <TextAreaInput
              size={"3"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            onClick={handleSubmit}
          >
            {mode === "create" ? "افزودن" : "ویرایش"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default CategoryFormDialog;
