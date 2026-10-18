import PasswordFields from "@/features/setting/components/profile/password-fields";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Box, Callout } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/shared/auth/use-auth";
import { personnelApi } from "@/features/personnel/api";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/setting/security")({ component: SecurityPage });

function SecurityPage() {
  const { user, refetchUser } = useAuth();
  useEffect(() => {
    if (user && !user.is_store_owner && !user.credentials_notice_viewed) {
      void personnelApi.dismissCredentialsNotice().then(refetchUser);
    }
  }, [user, refetchUser]);
  return (
    <Box dir="rtl" className="mx-auto w-full max-w-3xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="امنیت" description="تغییر رمز عبور به تأیید سرور و اتصال اینترنت نیاز دارد." icon={LockClosedIcon} />
      {user?.temporary_password_required ? <Callout.Root color="orange" mb="4"><Callout.Text>این حساب با رمز موقت ساخته شده است. تا تغییر موفق رمز، دسترسی عملیاتی متوقف می‌ماند.</Callout.Text></Callout.Root> : null}
      <OnlineGuard><PasswordFields /></OnlineGuard>
    </Box>
  );
}
