import PasswordFields from "@/features/setting/components/profile/password-fields";
import PersonalInformationFields from "@/features/setting/components/profile/personal-information-fields";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";

export const Route = createFileRoute("/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <OnlineGuard><Box>
      <Text className="text-2xl font-bold">
        تنظیمات پروفایل
      </Text>
      <PersonalInformationFields />
      <PasswordFields />
    </Box></OnlineGuard>
  );
}
