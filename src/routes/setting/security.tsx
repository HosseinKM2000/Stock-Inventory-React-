import PasswordFields from "@/features/setting/components/profile/password-fields";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Box, Callout, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/shared/auth/use-auth";
import { personnelApi } from "@/features/personnel/api";

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
      <h1 className="text-2xl font-bold">امنیت</h1>
      <Text as="p" size="2" color="gray" mt="2" mb="5">
        تغییر رمز عبور به تأیید سرور و اتصال اینترنت نیاز دارد.
      </Text>
      {user?.temporary_password_required ? <Callout.Root color="orange" mb="4"><Callout.Text>این حساب با رمز موقت ساخته شده است. تا تغییر موفق رمز، دسترسی عملیاتی متوقف می‌ماند.</Callout.Text></Callout.Root> : null}
      <OnlineGuard><PasswordFields /></OnlineGuard>
    </Box>
  );
}
