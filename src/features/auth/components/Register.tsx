import { useAppForm } from "@/shared/lib/form/use-app-form";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";
import { useRef } from "react";
import { authErrorMessage } from "../auth-error";
import { useRegister } from "../mutations/use-register";
import { registerSchema } from "../validators/register.schema";
import { ApiError } from "@/shared/api/api-error";
import { DUPLICATE_MOBILE_MESSAGE } from "../mobile";

function RegisterComponent() {
  const registerMutation = useRegister();
  const submittingRef = useRef(false);
  const form = useAppForm({
    schema: registerSchema,
    initialValues: { username: "", phone: "", password: "", repeatPassword: "" },
    onSubmit(values) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      registerMutation.mutate(
        { username: values.username, phone: values.phone, password: values.password },
        {
          onError(error) {
            if (error instanceof ApiError && error.message === DUPLICATE_MOBILE_MESSAGE) {
              form.setFieldError("phone", DUPLICATE_MOBILE_MESSAGE);
            }
          },
          onSettled: () => { submittingRef.current = false; },
        },
      );
    },
  });
  const duplicatePhoneError = registerMutation.error instanceof ApiError
    && registerMutation.error.message === DUPLICATE_MOBILE_MESSAGE;
  const serverError = registerMutation.isError && !duplicatePhoneError
    ? authErrorMessage(registerMutation.error, "ثبت‌نام انجام نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.")
    : null;

  return (
    <Form className="min-h-dvh w-full" dir="rtl" isSubmitting={registerMutation.isPending} onSubmit={preventEventHandler(form.submit)}>
      <Flex minHeight="100dvh" px="4" py="7" align="center" justify="center">
        <Flex width="100%" maxWidth="360px" gap="4" direction="column">
          <Box>
            <Text as="div" size="6" weight="bold">ساخت حساب تنظیم</Text>
            <Text as="p" size="2" color="gray" mt="2">فعلاً فقط اطلاعات ورود را وارد کنید؛ مشخصات پروفایل را بعداً تکمیل می‌کنید.</Text>
          </Box>
          {serverError ? <Callout.Root color="red"><Callout.Text>{serverError}</Callout.Text></Callout.Root> : null}
          <FormField label="نام کاربری" id="username" error={form.errors.username}>
            <TextInput size="3" name="username" autoComplete="username" value={form.values.username} onChange={form.handleChange} />
          </FormField>
          <FormField label="شماره موبایل" id="phone" error={form.errors.phone}>
            <TextInput size="3" name="phone" inputMode="tel" autoComplete="tel" dir="ltr" value={form.values.phone} onChange={form.handleChange} />
          </FormField>
          <FormField label="رمز عبور" id="password" error={form.errors.password}>
            <PasswordInput size="3" name="password" autoComplete="new-password" value={form.values.password} onChange={form.handleChange} />
          </FormField>
          <FormField label="تکرار رمز عبور" id="repeatPassword" error={form.errors.repeatPassword}>
            <PasswordInput size="3" name="repeatPassword" autoComplete="new-password" value={form.values.repeatPassword} onChange={form.handleChange} />
          </FormField>
          <Button type="submit" className="w-full" loading={registerMutation.isPending}>ساخت حساب</Button>
          <Link asChild size="2" color="violet"><RouterLink to="/auth/login">از قبل حساب دارید؟ وارد شوید</RouterLink></Link>
        </Flex>
      </Flex>
    </Form>
  );
}

export default RegisterComponent;
