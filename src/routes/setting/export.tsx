import ExportTools from "@/features/setting/components/export";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/export")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold">
        فایل خروجی
      </Text>
      <ExportTools />
    </Box>
  );
}
