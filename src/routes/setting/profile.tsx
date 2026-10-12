import PersonalInformationFields from "@/features/setting/components/profile/personal-information-fields";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";
import { ProfileMediaSelector } from "@/features/setting/components/profile/profile-media-selector";

export const Route = createFileRoute("/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <Box className="w-full min-w-0">
      <Text className="text-2xl font-bold">
        تنظیمات پروفایل
      </Text>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">
        تصویر و اطلاعات حساب خود را مشاهده کنید؛ ثبت تغییرات اطلاعات حساب به اتصال اینترنت نیاز دارد.
      </Text>
      <ProfileMediaSelector />
      <OnlineGuard>
        <PersonalInformationFields />
      </OnlineGuard>
    </Box>
  );
}
