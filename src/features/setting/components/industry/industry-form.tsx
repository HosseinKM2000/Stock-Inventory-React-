
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { Box, Button, Callout, Flex, Heading, Link, Text } from "@radix-ui/themes";
import { CubeIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useIndustries, useSetIndustry } from "../../mutations/use-industry";
import { ApiError } from "@/shared/api/api-error";

type IndustryFormProps = {
  mode?: "onboarding" | "settings";
};

function IndustryForm({ mode = "onboarding" }: IndustryFormProps) {
  const embedded = mode === "settings";
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

  const serverError =
    setIndustryMutation.error instanceof ApiError
      ? setIndustryMutation.error.message
      : setIndustryMutation.isError
        ? "خطا در ارتباط با سرور"
        : null;

  return (
    <Flex className="industry-selector-shell" data-embedded={embedded || undefined} data-mode={mode}>
      <Form
        isDirty={industry !== ""}
        className={embedded ? "industry-selector-form w-full" : "industry-selector-form min-h-dvh w-full"}
        isSubmitting={setIndustryMutation.isPending}
        onSubmit={preventEventHandler(loginHandler)}
      >
        <Flex
          direction="column"
          gapY="5"
          className="industry-selector-panel"
        >
          <Box className="industry-selector-heading">
            <span className="industry-selector-icon" aria-hidden="true"><CubeIcon width="22" height="22" /></span>
            <Box>
              <Heading as="h2" size="6">{embedded ? "تغییر حوزه کاری" : "حوزه کاری مجموعه"}</Heading>
              <Text as="p" size="2" color="gray">
                {embedded
                  ? "حوزه مناسب مجموعه را انتخاب کنید؛ کاتالوگ و ابزارهای مرتبط با انتخاب تازه به‌روزرسانی می‌شوند."
                  : "برای آماده‌سازی کاتالوگ و ابزارهای مرتبط، حوزه فعالیت مجموعه را انتخاب کنید."}
              </Text>
            </Box>
          </Box>

          {serverError && (
            <Callout.Root color="red" dir="rtl" className="w-full">
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

          <Box className="industry-selector-control">
            <FormField id="industry" label="حوزه فعالیت">
              <SelectInput
                name="industry"
                size="3"
                options={
                  industries?.map((industry) => ({
                    label: industry.name,
                    value: industry.id.toString(),
                  })) ?? []
                }
                placeholder={industriesLoading ? "در حال دریافت حوزه‌ها…" : "انتخاب حوزه کاری"}
                value={industry ?? ""}
                onValueChange={(value: string) => setIndustry(value ?? "")}
              />
            </FormField>
          </Box>
          <Box className="industry-selector-actions">
            <Button
              type="submit"
              style={{ width: "100%" }}
              loading={setIndustryMutation.isPending}
              disabled={industriesLoading || !industry}
            >
              {embedded ? "ذخیره تغییرات" : "ذخیره و ادامه"}
            </Button>
            {!embedded ? (
              <Link href="/dashboard" style={{ width: "100%" }}>
                فعلاً رد کردن
              </Link>
            ) : null}
          </Box>
        </Flex>
      </Form>
    </Flex>
  );
}

export default IndustryForm;
