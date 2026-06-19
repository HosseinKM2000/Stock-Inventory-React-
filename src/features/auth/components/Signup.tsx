import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Form } from "@/shared/ui/form/form";
import { FormField } from "@/shared/ui/form/field/form-field";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { ApiError } from "@/shared/api/client";
import { useSignup } from "@/features/auth/hooks/use-auth";
import { Callout, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { signupSchema } from "../validators/signup.schema";

type SignupForm = {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  repeatPassword: string;
};

type FieldErrors = Partial<Record<keyof SignupForm, string>>;

// eslint-disable-next-line react-refresh/only-export-components
function SignupComponent() {
  const [form, setForm] = useState<SignupForm>({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    repeatPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const signupMutation = useSignup();

  const handleInputsChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const signupHandler = () => {
    const validationResult = signupSchema.safeParse(form);

    if (!validationResult.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as keyof SignupForm | undefined;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const { firstName, lastName, username, password } = validationResult.data;
    signupMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      username,
      password,
    });
  };

  const serverError =
    signupMutation.error instanceof ApiError
      ? signupMutation.error.message
      : signupMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Form
      onSubmit={preventEventHandler(signupHandler)}
      isSubmitting={signupMutation.isPending}
      className="flex flex-col gap-y-4 justify-center items-center h-dvh w-full"
    >
      <Text size="6" weight="bold">
        ثبت نام
      </Text>

      {serverError && (
        <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
          <Callout.Text>{serverError}</Callout.Text>
        </Callout.Root>
      )}

      <div className="w-[90%] sm:w-90 h-fit">
        <FormField id="firstName" error={errors.firstName}>
          <TextInput
            placeholder="نام"
            size={"3"}
            name="firstName"
            value={form.firstName}
            onChange={handleInputsChange}
          />
        </FormField>
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FormField id="lastName" error={errors.lastName}>
          <TextInput
            placeholder="نام خانوادگی"
            size={"3"}
            name="lastName"
            value={form.lastName}
            onChange={handleInputsChange}
          />
        </FormField>
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FormField id="username" error={errors.username}>
          <TextInput
            placeholder="نام کاربری"
            size={"3"}
            name="username"
            value={form.username}
            onChange={handleInputsChange}
          />
        </FormField>
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FormField id="password" error={errors.password}>
          <TextInput
            placeholder="رمز عبور"
            type="password"
            size={"3"}
            name="password"
            value={form.password}
            onChange={handleInputsChange}
          />
        </FormField>
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FormField id="repeatPassword" error={errors.repeatPassword}>
          <TextInput
            placeholder="تکرار رمز عبور"
            type="password"
            size={"3"}
            name="repeatPassword"
            value={form.repeatPassword}
            onChange={handleInputsChange}
          />
        </FormField>
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <Button
          type="submit"
          style={{ width: "100%" }}
          loading={signupMutation.isPending}
        >
          ثبت
        </Button>
      </div>
      <Link asChild size={"2"} color="indigo">
        <RouterLink to="/auth/login">قبلا وارد شده اید !</RouterLink>
      </Link>
    </Form>
  );
}

export default SignupComponent;
