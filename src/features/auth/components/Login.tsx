import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";


import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { useAppForm } from "@/shared/lib/form/use-app-form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { useLogin } from "../mutations/use-register";
import { loginSchema } from "../validators/login.schema";
import { authErrorMessage } from "../auth-error";

function LoginComponent() {
  const loginMutation = useLogin();

  const form = useAppForm({
    schema: loginSchema,
    initialValues: {
      username: "",
      password: "",
    },
    onSubmit(values) {
      loginMutation.mutate({
        username: values.username,
        password: values.password,
      });
    },
  });

  const serverError =
    loginMutation.isError
      ? authErrorMessage(loginMutation.error, "ورود ناموفق بود. دوباره تلاش کنید.")
      : null;

  return (
    <Form
      className="h-dvh w-full"
      isSubmitting={loginMutation.isPending}
      onSubmit={preventEventHandler(form.submit)}
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
          <FormField id="username" error={form.errors.username}>
            <TextInput
              name="username"
              size="3"
              placeholder="نام کاربری"
              value={form.values.username}
              onChange={form.handleChange}
            />
          </FormField>
        </Box>

        <Box className="w-[90%] sm:w-90">
          <FormField id="password" error={form.errors.password}>
            <PasswordInput
              name="password"
              type="password"
              size="3"
              placeholder="رمز عبور"
              value={form.values.password}
              onChange={form.handleChange}
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
