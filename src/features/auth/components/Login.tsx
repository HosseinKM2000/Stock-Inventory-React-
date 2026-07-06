import { useState } from "react";

import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";

import { ApiError } from "@/services/api/api-error";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { useLogin } from "../mutations/use-register";
import { loginSchema } from "../validators/login.schema";

type LoginForm = {
  username: string;
  password: string;
};

type FieldErrors = Partial<Record<keyof LoginForm, string>>;

function LoginComponent() {
  const loginMutation = useLogin();

  const [form, setForm] = useState<LoginForm>({
    username: "",
    password: "",
  });

  const [errors, setErrors] = useState<FieldErrors>({});

  function handleInputChange(e: {
    target: {
      name: string;
      value: string;
    };
  }) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function loginHandler() {
    const validation = loginSchema.safeParse(form);

    if (!validation.success) {
      const fieldErrors: FieldErrors = {};

      for (const issue of validation.error.issues) {
        const field = issue.path[0] as keyof LoginForm;

        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }

      setErrors(fieldErrors);
      return;
    }

    setErrors({});

    loginMutation.mutate(validation.data);
  }

  const serverError =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Form
      className="h-dvh w-full"
      isSubmitting={loginMutation.isPending}
      onSubmit={preventEventHandler(loginHandler)}
    >
      <Flex
        height="100%"
        direction="column"
        align="center"
        justify="center"
        gapY="4"
      >
        <Text size="6" weight="bold">
          ورود
        </Text>

        {serverError && (
          <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
            <Callout.Text>{serverError}</Callout.Text>
          </Callout.Root>
        )}

        <Box className="w-[90%] sm:w-90">
          <FormField id="username" error={errors.username}>
            <TextInput
              name="username"
              size="3"
              placeholder="نام کاربری"
              value={form.username}
              onChange={handleInputChange}
            />
          </FormField>
        </Box>

        <Box className="w-[90%] sm:w-90">
          <FormField id="password" error={errors.password}>
            <PasswordInput
              name="password"
              type="password"
              size="3"
              placeholder="رمز عبور"
              value={form.password}
              onChange={handleInputChange}
            />
          </FormField>
        </Box>

        <Box className="w-[90%] sm:w-90">
          <Button
            type="submit"
            style={{ width: "100%" }}
            loading={loginMutation.isPending}
          >
            ورود
          </Button>
        </Box>

        <Link asChild size="2" color="indigo">
          <RouterLink to="/auth/register">هنوز حسابی ندارید؟</RouterLink>
        </Link>
      </Flex>
    </Form>
  );
}

export default LoginComponent;
