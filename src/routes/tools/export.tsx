import ExportTools from "@/features/setting/components/export";
import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/tools/export")({ component: ExportPage });

function ExportPage() {
  return (
    <Box dir="rtl">
      <PageGuide section="ابزارها" sectionTo="/tools" title="خروجی" description="از داده‌های ذخیره‌شده روی دستگاه خروجی آفلاین بگیرید یا در حالت آنلاین فایل مبتنی بر داده‌های سرور دریافت کنید." icon={DownloadIcon} />
      <ExportTools />
    </Box>
  );
}
