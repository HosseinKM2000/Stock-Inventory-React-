import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import AppearanceOptions from "@/features/setting/components/appearance";

export const Route = createFileRoute("/setting/appearance")({
  component: AppearanceComponent,
});

function AppearanceComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold">
        تنظیمات ظاهری
      </Text>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">
        حالت نمایش برنامه را متناسب با دستگاه یا ترجیح شخصی خود انتخاب کنید؛ این تنظیم روی همین دستگاه ذخیره می‌شود.
      </Text>
      <AppearanceOptions />
    </Box>
  );
}
