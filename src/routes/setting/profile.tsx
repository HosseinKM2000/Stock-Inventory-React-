import PasswordFields from "@/features/setting/components/profile/password-fields";
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
      <ProfileMediaSelector />
      <OnlineGuard>
        <PersonalInformationFields />
        <PasswordFields />
      </OnlineGuard>
    </Box>
  );
}
