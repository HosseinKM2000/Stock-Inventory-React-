import Industries from "@/features/setting/components/industry";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/industry")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold">حوزه کاری</Text>
      <Industries />
    </Box>
  );
}
