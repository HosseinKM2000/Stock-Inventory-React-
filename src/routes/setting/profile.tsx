import PersonalInformationFields from "@/features/setting/components/profile/personal-information-fields";
import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";
import { ProfileMediaSelector } from "@/features/setting/components/profile/profile-media-selector";
import { PersonIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <Box className="w-full min-w-0">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="تنظیمات پروفایل" description="تصویر و اطلاعات حساب خود را مشاهده کنید؛ ثبت تغییرات اطلاعات حساب به اتصال اینترنت نیاز دارد." icon={PersonIcon} />
      <ProfileMediaSelector />
      <OnlineGuard>
        <PersonalInformationFields />
      </OnlineGuard>
    </Box>
  );
}
