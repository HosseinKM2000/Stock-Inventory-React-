import { useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { Callout, Dialog, Flex } from "@radix-ui/themes";

import {
  useCreateIndustry,
  useUpdateIndustry,
} from "../../mutations/use-industry";

import { SwitchInput } from "@/shared/ui/button/toggle-button";
import type { IndustryInput, Industry } from "../../types";
import { ApiError } from "@/shared/api/api-error";

type Props = {
  mode: "create" | "edit";
  industry?: Industry;
  trigger: ReactNode;
};

const emptyForm: IndustryInput = {
  name: "",
  description: "",
  is_active: true,
};

export default function IndustryFormDialog({ mode, industry, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<IndustryInput>(emptyForm);

  const createMutation = useCreateIndustry();
  const updateMutation = useUpdateIndustry();

  const mutation = mode === "create" ? createMutation : updateMutation;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (!next) return;

    mutation.reset();

    if (mode === "edit" && industry) {
      setForm({
        name: industry.name,
        description: industry.description ?? "",
        is_active: industry.is_active,
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

    if (!industry) return;

    const data: IndustryInput = form;

    updateMutation.mutate(
      {
        id: industry.id,
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
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>

      <Dialog.Content maxWidth="500px">
        <Dialog.Title>
          {mode === "create" ? "افزودن حوزه کاری" : "ویرایش حوزه کاری"}
        </Dialog.Title>

        {errorMessage && (
          <Callout.Root color="red" mb="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="4">
          <FormField label="عنوان" id="industry-name">
            <TextInput
              name="name"
              value={form.name}
              id="industry-name"
              onChange={handleChange}
            />
          </FormField>
          <FormField label="توضیحات" id="industry-description">
            <TextAreaInput
              name="description"
              onChange={handleChange}
              value={form.description}
              id="industry-description"
            />
          </FormField>
          <FormField label="فعال/غیر فعال" id="industry-description">
            <SwitchInput
              checked={form.is_active}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  is_active: checked,
                }))
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

          <Button loading={mutation.isPending} onClick={handleSubmit}>
            {mode === "create" ? "ایجاد" : "ذخیره"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
