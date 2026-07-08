
import { passwordSchema } from "@/shared/validation/password.schema";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Box, Callout, Grid, Text } from "@radix-ui/themes";
import { useState } from "react";
import { useUpdatePassword } from "@/features/auth/mutations/use-register";
import { ApiError } from "@/shared/api/api-error";

const PasswordFields = () => {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const updatePassword = useUpdatePassword();

  const handleSubmit = () => {
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "رمز عبور نامعتبر است");
      return;
    }
    if (password !== repeatPassword) {
      setValidationError("رمز عبور و تکرار آن یکسان نیستند");
      return;
    }
    setValidationError(null);
    updatePassword.mutate(password, {
      onSuccess: () => {
        setPassword("");
        setRepeatPassword("");
      },
    });
  };

  const serverError =
    updatePassword.error instanceof ApiError ? updatePassword.error.message : null;
  const errorMessage = validationError ?? serverError;

  return (
    <Form
      onSubmit={preventEventHandler(handleSubmit)}
      isSubmitting={updatePassword.isPending}
    >
      <Box
        mt={"6"}
        mb={{ xs: "9", md: "0" }}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">امنیت</Text>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mt="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}
        {updatePassword.isSuccess && (
          <Callout.Root color="green" dir="rtl" mt="4">
            <Callout.Text>رمز عبور با موفقیت تغییر کرد</Callout.Text>
          </Callout.Root>
        )}

        <Grid gap={"5"} width="auto" mt={"5"} columns={{ xs: "1", md: "3" }}>
          <FormField label="رمز عبور" id="password">
            <PasswordInput
              size={"3"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label="تکرار رمز عبور" id="repeat-password">
            <PasswordInput
              size={"3"}
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
            />
          </FormField>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button type="submit" loading={updatePassword.isPending}>
            ویرایش رمز عبور
          </Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PasswordFields;
