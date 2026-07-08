import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Callout, Dialog, Flex } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/shared/api/api-error";
import type { Category, CategoryInput } from "../../types";
import {
  useCreateCategory,
  useUpdateCategory,
} from "../../mutations/use-categories";

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

  const [form, setForm] = useState<CategoryInput>(emptyForm);

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const mutation = mode === "create" ? createMutation : updateMutation;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (!next) return;

    mutation.reset();

    if (mode === "edit" && category) {
      setForm({
        name: category.name,
        description: category.description ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  };

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    console.log(value);
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return;

    if (mode === "create") {
      createMutation.mutate(form, {
        onSuccess() {
          setOpen(false);
        },
      });

      return;
    }

    if (!category) return;

    const data: CategoryInput = form;

    updateMutation.mutate(
      {
        id: category.id,
        data,
      },
      {
        onSuccess() {
          setOpen(false);
        },
      },
    );
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
        <Dialog.Description size="2" mb="4"></Dialog.Description>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mb="3">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="3">
          <FormField label="عنوان" id="category-name">
            <TextInput
              name="name"
              size={"3"}
              value={form.name}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="توضیحات" id="category-description">
            <TextAreaInput
              name="description"
              size={"3"}
              value={form.description}
              onChange={handleChange}
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
