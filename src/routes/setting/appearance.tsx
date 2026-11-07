import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import AppearanceOptions from "@/features/setting/components/appearance";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/setting/appearance")({
  component: AppearanceComponent,
});

function AppearanceComponent() {
  return (
    <Box>
      <PageGuide section="تنظیمات" sectionTo="/setting" title="تنظیمات ظاهری" description="حالت نمایش برنامه را متناسب با دستگاه یا ترجیح شخصی خود انتخاب کنید؛ این تنظیم روی همین دستگاه ذخیره می‌شود." icon={MixerHorizontalIcon} />
      <AppearanceOptions />
    </Box>
  );
}
