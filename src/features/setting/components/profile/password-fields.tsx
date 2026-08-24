import { Box, Callout, Grid, Text } from "@radix-ui/themes";

import { Button } from "@/shared/ui/button/button";
import { Form } from "@/shared/ui/form/form";
import { FormField } from "@/shared/ui/form/field/form-field";
import { PasswordInput } from "@/shared/ui/form/input/password-input";

import { useAppForm } from "@/shared/lib/form/use-app-form";
import { preventEventHandler } from "@/shared/lib/prevent-event";

import { ApiError } from "@/shared/api/api-error";

import { useUpdatePassword } from "@/features/auth/mutations/use-register";
import { passwordSchema } from "@/shared/validation/password.schema";
import { z } from "zod";

const schema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی را وارد کنید"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine(
    (data) => data.newPassword === data.confirmNewPassword,
    {
      path: ["confirmNewPassword"],
      message: "رمز عبور و تکرار یکسان نیستند",
    },
  )
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "رمز عبور جدید باید با رمز فعلی متفاوت باشد",
  });

const emptyValues: z.input<typeof schema> = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

const PasswordFields = () => {
  const updatePassword = useUpdatePassword();

  const form = useAppForm({
    schema,
    initialValues: emptyValues,

    onSubmit(values) {
      updatePassword.mutate({
        current_password: values.currentPassword,
        new_password: values.newPassword,
      }, {
        onSuccess() {
          form.reset();
        },
      });
    },
  });

  const errorMessage =
    updatePassword.error instanceof ApiError
      ? updatePassword.error.message === "CURRENT_PASSWORD_INCORRECT"
        ? "رمز عبور فعلی صحیح نیست"
        : updatePassword.error.message === "NEW_PASSWORD_MUST_DIFFER"
          ? "رمز عبور جدید باید با رمز فعلی متفاوت باشد"
          : updatePassword.error.message
      : updatePassword.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Form
      onSubmit={preventEventHandler(form.submit)}
      isSubmitting={updatePassword.isPending}
    >
      <Box
        mt="6"
        mb={{ xs: "9", md: "0" }}
        className="bg-foreground/5 p-5 rounded-2xl border border-foreground/20"
      >
        <Text className="text-xl font-medium">امنیت</Text>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mt="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        {updatePassword.isSuccess && (
          <Callout.Root color="green" dir="rtl" mt="4">
            <Callout.Text>
              رمز عبور با موفقیت تغییر کرد
            </Callout.Text>
          </Callout.Root>
        )}

        <Grid
          gap="5"
          mt="5"
          columns={{ xs: "1", md: "3" }}
        >
          <FormField
            label="رمز عبور فعلی"
            id="currentPassword"
            error={form.errors.currentPassword}
          >
            <PasswordInput
              size="3"
              name="currentPassword"
              autoComplete="current-password"
              value={form.values.currentPassword}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="رمز عبور جدید"
            id="newPassword"
            error={form.errors.newPassword}
          >
            <PasswordInput
              size="3"
              name="newPassword"
              autoComplete="new-password"
              value={form.values.newPassword}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="تکرار رمز عبور جدید"
            id="confirmNewPassword"
            error={form.errors.confirmNewPassword}
          >
            <PasswordInput
              size="3"
              name="confirmNewPassword"
              autoComplete="new-password"
              value={form.values.confirmNewPassword}
              onChange={form.handleChange}
            />
          </FormField>
        </Grid>

        <Grid width="100%" mt="6">
          <Button
            type="submit"
            loading={updatePassword.isPending}
          >
            ویرایش رمز عبور
          </Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PasswordFields;
