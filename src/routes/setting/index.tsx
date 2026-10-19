import { QuickAccessPage } from "@/features/app/layout/quick-access-page";
import { settingsNavigationItems } from "@/features/app/layout/navigation-items";
import { useLogout } from "@/features/auth/mutations/use-register";
import { Button } from "@/shared/ui/button/button";
import { ExitIcon } from "@radix-ui/react-icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/")({ component: SettingsAccessPage });

function SettingsAccessPage() {
  const logout = useLogout();
  return (
    <QuickAccessPage
      title="تنظیمات"
      description="اطلاعات حساب، امنیت، ظاهر برنامه و تنظیمات شخصی را از اینجا مدیریت کنید."
      items={settingsNavigationItems}
      footer={
        <Button color="red" variant="soft" onClick={logout} className="min-h-11">
          <ExitIcon />
          خروج از حساب کاربری
        </Button>
      }
    />
  );
}
