import PasswordFields from "@/features/setting/components/profile/password-fields";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/security")({ component: SecurityPage });

function SecurityPage() {
  return (
    <Box dir="rtl" className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold">امنیت</h1>
      <Text as="p" size="2" color="gray" mt="2" mb="5">
        تغییر رمز عبور به تأیید سرور و اتصال اینترنت نیاز دارد.
      </Text>
      <OnlineGuard><PasswordFields /></OnlineGuard>
    </Box>
  );
}
