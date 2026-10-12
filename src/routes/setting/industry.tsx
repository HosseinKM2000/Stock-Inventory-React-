import IndustryForm from "@/features/setting/components/industry/industry-form";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/industry")({ component: IndustryPage });

function IndustryPage() {
  return (
    <Box dir="rtl" className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold">حوزه کاری</h1>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">
        حوزه فعالیت حساب خود را انتخاب کنید تا کاتالوگ و امکانات مرتبط نمایش داده شوند. تغییر این گزینه نیازمند اینترنت است.
      </Text>
      <OnlineGuard><IndustryForm embedded /></OnlineGuard>
    </Box>
  );
}
