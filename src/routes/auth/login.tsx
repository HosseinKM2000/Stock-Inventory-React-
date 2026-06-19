import { useState, type FormEvent } from "react";
import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Form } from "@/shared/ui/form/form";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { useLogin } from "@/features/auth/hooks/use-auth";
import { ApiError } from "@/shared/api/client";
import { Callout, Link, Text } from "@radix-ui/themes";
import { Link as RouterLink, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    preventEventHandler(() => {
      loginMutation.mutate({ username, password });
    })(event);
  };

  const errorMessage =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Form
      onSubmit={handleSubmit}
      isSubmitting={loginMutation.isPending}
      className="flex flex-col gap-y-5 justify-center items-center h-dvh w-full"
    >
      <Text size="6" weight="bold">
        ورود
      </Text>

      {errorMessage && (
        <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
          <Callout.Text>{errorMessage}</Callout.Text>
        </Callout.Root>
      )}

      <div className="w-[90%] sm:w-90 h-fit">
        <TextInput
          placeholder="نام کاربری"
          size={"3"}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <TextInput
          placeholder="رمز عبور"
          type="password"
          size={"3"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <Button
          type="submit"
          style={{ width: "100%" }}
          loading={loginMutation.isPending}
        >
          ورود
        </Button>
      </div>
      <Link asChild size={"2"} color="indigo">
        <RouterLink to="/auth/signup">هنوز حسابی ندارید!</RouterLink>
      </Link>
    </Form>
  );
}
