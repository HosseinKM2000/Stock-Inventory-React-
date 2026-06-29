import { useState } from "react";
import { Form } from "@/shared/ui/form/form";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { FormField } from "@/shared/ui/form/field/form-field";
import { registerSchema } from "../validators/register.schema";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { useRegister } from "../mutations/use-register";

type RegisterForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  repeatPassword: string;
};

type FieldErrors = Partial<Record<keyof RegisterForm, string>>;

// eslint-disable-next-line react-refresh/only-export-components
function RegisterComponent() {
  const [form, setForm] = useState<RegisterForm>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    repeatPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const RegisterMutation = useRegister();

  const handleInputsChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const RegisterHandler = () => {
    const validationResult = registerSchema.safeParse(form);

    if (!validationResult.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as keyof RegisterForm | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const { firstName, lastName, username, password } = validationResult.data;
    RegisterMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      username,
      password,
    });
  };

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
      onSubmit={preventEventHandler(RegisterHandler)}
    >
      <Flex
        gapY={"4"}
        height={"100%"}
        align={"center"}
        justify={"center"}
        direction={"column"}
      >
        <Text size="6" weight="bold">
          ثبت نام
        </Text>

        {serverError && (
          <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
            <Callout.Text>{serverError}</Callout.Text>
          </Callout.Root>
        )}

        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="firstName" error={errors.firstName}>
            <TextInput
              size={"3"}
              name="firstName"
              placeholder="نام"
              value={form.firstName}
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="lastName" error={errors.lastName}>
            <TextInput
              size={"3"}
              name="lastName"
              value={form.lastName}
              placeholder="نام خانوادگی"
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="username" error={errors.username}>
            <TextInput
              size={"3"}
              name="username"
              value={form.username}
              placeholder="نام کاربری"
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="phone" error={errors.phone}>
            <TextInput
              size={"3"}
              name="phone"
              value={form.phone}
              placeholder="موبایل"
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="email" error={errors.email}>
            <TextInput
              size={"3"}
              name="email"
              value={form.email}
              placeholder="ایمیل"
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="password" error={errors.password}>
            <TextInput
              size={"3"}
              type="password"
              name="password"
              value={form.password}
              placeholder="رمز عبور"
              onChange={handleInputsChange}
            />
          </FormField>
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <FormField id="repeatPassword" error={errors.repeatPassword}>
            <TextInput
              size={"3"}
              type="password"
              name="repeatPassword"
              value={form.repeatPassword}
              placeholder="تکرار رمز عبور"
              onChange={handleInputsChange}
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
