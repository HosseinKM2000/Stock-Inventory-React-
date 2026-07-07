import { ApiError } from "@/services/api/api-error";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { Box, Button, Callout, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import { useIndustry } from "../mutations/use-industry";
import type { Industry } from "../types";

type FieldErrors = Partial<Record<keyof LoginForm, string>>;

function IndustryForm() {
  const loginMutation = useIndustry();
  const [industry, setIndustry] = useState<Industry>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  function loginHandler() {
    setErrors({});

    loginMutation.mutate(industry);
  }

  const serverError =
    loginMutation.error instanceof ApiError
      ? loginMutation.error.message
      : loginMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Flex>
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
            برای ادامه حوزه کاری خود را انتخاب کنید
          </Text>

          {serverError && (
            <Callout.Root color="red" dir="rtl" className="w-[90%] sm:w-90">
              <Callout.Text>{serverError}</Callout.Text>
            </Callout.Root>
          )}

          <Box className="w-[90%] sm:w-90">
            <FormField id="username" error={errors.username}>
              <SelectInput
                name="username"
                size="3"
                options={[{ label: "لوازم یدکی", value: "spare_parts" }]}
                placeholder="حوزه کاری"
                value={industry ?? ""}
                onValueChange={(value: string) =>
                  setIndustry(value as Industry)
                }
              />
            </FormField>
          </Box>

          <Box className="w-[90%] sm:w-90">
            <Button
              type="submit"
              style={{ width: "100%" }}
              //   loading={loginMutation.isPending}
            >
              ثبت
            </Button>
          </Box>
        </Flex>
      </Form>
    </Flex>
  );
}

export default IndustryForm;
