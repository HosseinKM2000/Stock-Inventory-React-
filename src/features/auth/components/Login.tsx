import { Form } from "@/shared/ui/form/form";
import { ApiError } from "@/shared/api/client";
import { useState, type FormEvent } from "react";
import { Button } from "@/shared/ui/button/button";
import { Link as RouterLink } from "@tanstack/react-router";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { useLogin } from "@/features/auth/mutations/use-register";
import { Box, Callout, Flex, Link, Text } from "@radix-ui/themes";

function LoginComponent() {
  const loginMutation = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
      className="h-dvh w-full"
    >
      <Flex
        gapY={"4"}
        height={"100%"}
        align={"center"}
        justify={"center"}
        direction={"column"}
      >
        <Text size="6" weight="bold">
          ورود
        </Text>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}

        <Box className="w-[90%] sm:w-90 h-fit">
          <TextInput
            placeholder="نام کاربری"
            size={"3"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <TextInput
            placeholder="رمز عبور"
            type="password"
            size={"3"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Box>
        <Box className="w-[90%] sm:w-90 h-fit">
          <Button
            type="submit"
            style={{ width: "100%" }}
            loading={loginMutation.isPending}
          >
            ورود
          </Button>
        </Box>
        <Link asChild size={"2"} color="indigo">
          <RouterLink to="/auth/register">هنوز حسابی ندارید!</RouterLink>
        </Link>
      </Flex>
    </Form>
  );
}

export default LoginComponent;
