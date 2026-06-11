import ExportTools from "@/features/setting/components/export";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/setting/export")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold underline underline-offset-10">
        فایل خروجی
      </Text>
      <ExportTools />
    </Box>
  );
}
