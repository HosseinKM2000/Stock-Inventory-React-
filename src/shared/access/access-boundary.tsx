import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { Callout, Card, Flex, Text } from "@radix-ui/themes";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { useEntitlement } from "./use-entitlement";
import { isAdmin } from "./authorization";
import { toast } from "sonner";

export function AccessBoundary({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const entitlement = useEntitlement();
  const expirationNotified = useRef(false);
  const expired = !isAdmin(user) && entitlement?.status === "expired";
  useEffect(() => {
    if (expired && !expirationNotified.current) {
      expirationNotified.current = true;
      toast.warning(
        "اشتراک شما منقضی شده است. برای تمدید و تأیید دسترسی‌ها دوباره آنلاین شوید.",
      );
    } else if (!expired) {
      expirationNotified.current = false;
    }
  }, [expired]);

  if (user?.is_active === false) {
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
          <Callout.Text>اشتراک منقضی شده است؛ اطلاعات قابل مشاهده‌اند اما تغییرات جدید تا تمدید اشتراک غیرفعال هستند.</Callout.Text>
        </Callout.Root>
      )}
      {children}
    </>
  );
}
