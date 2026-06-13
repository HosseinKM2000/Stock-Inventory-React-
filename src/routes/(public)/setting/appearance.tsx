import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import AppearanceOptions from "@/features/setting/components/appearance";

export const Route = createFileRoute("/(public)/setting/appearance")({
  component: AppearanceComponent,
});

function AppearanceComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold">
        تنظیمات ظاهری
      </Text>
      <AppearanceOptions />
    </Box>
  );
}
