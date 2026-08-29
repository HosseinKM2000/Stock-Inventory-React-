import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { Callout, Card, Flex, Text } from "@radix-ui/themes";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { useEntitlementAccess } from "./use-entitlement";
import { isAdmin } from "./authorization";
import { toast } from "sonner";

export function AccessBoundary({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const entitlement = useEntitlementAccess();
  const expirationNotified = useRef(false);
  const expired = Boolean(user) && !isAdmin(user) && entitlement.status === "expired";
  const verifying = Boolean(user) && !isAdmin(user) && entitlement.requiresOnlineVerification;
  useEffect(() => {
    if (expired && !expirationNotified.current) {
      expirationNotified.current = true;
      toast.warning(
        "اشتراک شما منقضی شده است. برای تمدید اشتراک و فعال‌سازی مجدد امکانات، لطفاً به اینترنت متصل شوید.",
      );
    } else if (!expired) {
      expirationNotified.current = false;
    }
  }, [expired]);

  if (user?.is_active === false || entitlement.status === "disabled") {
    return (
      <Flex minHeight="100vh" align="center" justify="center" p="4">
        <Card size="4" className="max-w-lg text-center">
          <Text as="div" size="6" weight="bold">حساب کاربری غیرفعال است</Text>
          <Text as="div" color="gray" mt="3">برای فعال‌سازی دوباره با مدیر سامانه تماس بگیرید.</Text>
          <Button mt="5" onClick={logout}>خروج از حساب</Button>
        </Card>
      </Flex>
    );
  }

  return (
    <>
      {expired && (
        <Callout.Root color="amber" m="3" dir="rtl">
          <Callout.Text>اشتراک شما منقضی شده است. اطلاعات و تغییرات در انتظار همگام‌سازی محفوظ مانده‌اند؛ برای تمدید و فعال‌سازی مجدد امکانات به اینترنت متصل شوید.</Callout.Text>
        </Callout.Root>
      )}
      {verifying && (
        <Callout.Root color="blue" m="3" dir="rtl">
          <Callout.Text>{entitlement.status === "missing" ? "اطلاعات معتبر اشتراک روی این دستگاه موجود نیست. برای تأیید و فعال‌سازی امکانات اشتراکی به اینترنت متصل شوید." : "در حال تأیید وضعیت اشتراک با سرور هستیم. امکانات اشتراکی پس از تأیید فعال می‌شوند."}</Callout.Text>
        </Callout.Root>
      )}
      {children}
    </>
  );
}
