import ExportTools from "@/features/setting/components/export";
import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/export")({ component: ExportPage });

function ExportPage() {
  return (
    <Box dir="rtl">
      <h1 className="text-2xl font-bold">خروجی</h1>
      <ExportTools />
    </Box>
  );
}
