import PersonalInformationFields from "@/features/setting/components/profile/personal-information-fields";
import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";
import { PersonIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <Box dir="rtl" className="settings-detail-workspace mx-auto w-full max-w-5xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="تنظیمات پروفایل" description="اطلاعات حساب و نام مجموعه را مدیریت کنید؛ ثبت تغییرات به اتصال اینترنت نیاز دارد." icon={PersonIcon} helpTopic="account" />
      <OnlineGuard>
        <PersonalInformationFields />
      </OnlineGuard>
    </Box>
  );
}
