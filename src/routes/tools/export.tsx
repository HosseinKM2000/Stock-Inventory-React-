import ExportTools from "@/features/setting/components/export";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/export")({ component: ExportPage });

function ExportPage() {
  return (
    <Box dir="rtl">
      <h1 className="text-2xl font-bold">خروجی</h1>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">
        از داده‌های ذخیره‌شده روی دستگاه خروجی آفلاین بگیرید یا در حالت آنلاین فایل مبتنی بر داده‌های سرور دریافت کنید.
      </Text>
      <ExportTools />
    </Box>
  );
}
