import { ApiError } from "@/services/api/api-error";
import { useAppForm } from "@/shared/lib/form/use-app-form";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";
import { useRegister } from "../mutations/use-register";
import { registerSchema } from "../validators/register.schema";

function RegisterComponent() {
  const RegisterMutation = useRegister();
  const form = useAppForm({
    schema: registerSchema,

    initialValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      repeatPassword: "",
    },

    onSubmit(values) {
      RegisterMutation.mutate({
        first_name: values.firstName,
        last_name: values.lastName,
        username: values.username,
        password: values.password,
        phone: values.phone,
      });
    },
  });

  const serverError =
    RegisterMutation.error instanceof ApiError
      ? RegisterMutation.error.message
      : RegisterMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Form
      className="h-dvh w-full"
      isSubmitting={RegisterMutation.isPending}
      onSubmit={preventEventHandler(form.submit)}
    >
      <Flex
        gapY={"4"}
        height={"100%"}
        align={"center"}
        justify={"center"}
        direction={"column"}
      >
        <Text size="6" weight="bold">
          ثبت اطلاعات
        </Text>

        {serverError && (
          <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
            <Callout.Text>{serverError}</Callout.Text>
          </Callout.Root>
        )}

        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="firstName" error={form.errors.firstName}>
            <TextInput
              size={"3"}
              name="firstName"
              placeholder="نام"
              value={form.values.firstName}
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="lastName" error={form.errors.lastName}>
            <TextInput
              size={"3"}
              name="lastName"
              value={form.values.lastName}
              placeholder="نام خانوادگی"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="username" error={form.errors.username}>
            <TextInput
              size={"3"}
              name="username"
              value={form.values.username}
              placeholder="نام کاربری"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="phone" error={form.errors.phone}>
            <TextInput
              size={"3"}
              name="phone"
              value={form.values.phone}
              placeholder="موبایل"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="email" error={form.errors.email}>
            <TextInput
              size={"3"}
              name="email"
              value={form.values.email}
              placeholder="ایمیل"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="password" error={form.errors.password}>
            <PasswordInput
              size={"3"}
              type="password"
              name="password"
              value={form.values.password}
              placeholder="رمز عبور"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="repeatPassword" error={form.errors.repeatPassword}>
            <PasswordInput
              size={"3"}
              type="password"
              name="repeatPassword"
              value={form.values.repeatPassword}
              placeholder="تکرار رمز عبور"
              onChange={form.handleChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <Button
            type="submit"
            style={{ width: "100%" }}
            loading={RegisterMutation.isPending}
          >
            ثبت
          </Button>
        </Box>
        <Link asChild size={"2"} color="indigo">
          <RouterLink to="/auth/login">قبلا وارد شده اید !</RouterLink>
        </Link>
      </Flex>
    </Form>
  );
}

export default RegisterComponent;
