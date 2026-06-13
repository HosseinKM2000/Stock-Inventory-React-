import PasswordFields from "@/features/setting/components/profile/password-fields";
import PersonalInformationFields from "@/features/setting/components/profile/personal-information-fields";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <Box>
      <Text className="text-2xl font-bold">
        تنظیمات پروفایل
      </Text>
      <PersonalInformationFields />
      <PasswordFields />
    </Box>
  );
}
