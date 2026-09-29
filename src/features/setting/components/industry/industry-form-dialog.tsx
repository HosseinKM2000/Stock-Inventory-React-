import { useState, type ReactNode } from "react";

import { Button } from "@/shared/ui/button/button";
import { SwitchInput } from "@/shared/ui/button/toggle-button";

import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { useAppForm } from "@/shared/lib/form/use-app-form";

import {
  useCreateIndustry,
  useUpdateIndustry,
} from "../../mutations/use-industry";

import type { Industry } from "../../types";

import { Callout, Dialog, Flex } from "@radix-ui/themes";
import {
  industrySchema,
  type IndustryFormValues,
} from "../../validators/industry.schema";
import { adminErrorMessage } from "../admin-error";

type Props = {
  mode: "create" | "edit";
  industry?: Industry;
  trigger: ReactNode;
};

const emptyValues: IndustryFormValues = {
  name: "",
  description: "",
  is_active: true,
};

export default function IndustryFormDialog({ mode, industry, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const createMutation = useCreateIndustry();
  const updateMutation = useUpdateIndustry();

  const mutation = mode === "create" ? createMutation : updateMutation;

  const form = useAppForm({
    schema: industrySchema,
    initialValues: emptyValues,

    onSubmit(values) {
      if (mode === "create") {
        createMutation.mutate(values, {
          onSuccess() {
            setOpen(false);
            form.reset();
          },
        });

        return;
      }

      if (!industry) return;

      updateMutation.mutate(
        {
          id: industry.id,
          data: values,
        },
        {
          onSuccess() {
            setOpen(false);
          },
        },
      );
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      mutation.reset();
      if (mode === "edit" && industry) {
        form.load({
          name: industry.name,
          description: industry.description ?? "",
          is_active: industry.is_active,
        });
      } else {
        form.reset();
      }
    }
    setOpen(next);
  };

  const errorMessage =
    mutation.isError
      ? adminErrorMessage(mutation.error, "ذخیره حوزه کاری ناموفق بود")
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
          <FormField label="عنوان" id="industry-name" error={form.errors.name}>
            <TextInput
              name="name"
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
              name="description"
              value={form.values.description}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField label="فعال / غیرفعال" id="industry-active">
            <SwitchInput
              checked={form.values.is_active}
              onCheckedChange={(checked) => form.setValue("is_active", checked)}
            />
          </FormField>
        </Flex>

        <Flex justify="end" gap="3" mt="6">
          <Dialog.Close>
            <Button color="gray" variant="soft">
              لغو
            </Button>
          </Dialog.Close>

          <Button loading={mutation.isPending} onClick={form.submit}>
            {mode === "create" ? "ایجاد" : "ذخیره"}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
