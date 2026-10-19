
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { Box, Button, Callout, Flex, Link, Text } from "@radix-ui/themes";
import { useState } from "react";
import { useIndustries, useSetIndustry } from "../../mutations/use-industry";
import { ApiError } from "@/shared/api/api-error";

function IndustryForm() {
  const setIndustryMutation = useSetIndustry();
  const [industry, setIndustry] = useState<string>("");

  const {
    data: industries = [],
    isLoading: industriesLoading,
    isError,
    error,
  } = useIndustries();

  function loginHandler() {
    setIndustryMutation.mutate(Number(industry));
  }

  console.log(industries);
  const serverError =
    setIndustryMutation.error instanceof ApiError
      ? setIndustryMutation.error.message
      : setIndustryMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Flex>
      <Form
        className="h-dvh w-full"
        isSubmitting={setIndustryMutation.isPending}
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
          {isError && (
            <Callout.Root color="red">
              <Callout.Text>
                {error instanceof Error
                  ? error.message
                  : "خطا در دریافت حوزه‌های کاری"}
              </Callout.Text>
            </Callout.Root>
          )}

          <Box className="w-[90%] sm:w-90">
            <FormField id="username">
              <SelectInput
                name="username"
                size="3"
                options={
                  industries?.map((industry) => ({
                    label: industry.name,
                    value: industry.id.toString(),
                  })) ?? []
                }
                placeholder="حوزه کاری"
                value={industry ?? ""}
                onValueChange={(value: string) => setIndustry(value ?? "")}
              />
            </FormField>
          </Box>
          <Box className="w-[90%] sm:w-90">
            <Button
              type="submit"
              style={{ width: "100%" }}
              loading={setIndustryMutation.isPending}
              disabled={industriesLoading || !industry}
            >
              ثبت
            </Button>
          </Box>
          <Box className="w-[90%] sm:w-90 text-center">
            <Link href="/" style={{ width: "100%" }}>
              رد کردن
            </Link>
          </Box>
        </Flex>
      </Form>
    </Flex>
  );
}

export default IndustryForm;
