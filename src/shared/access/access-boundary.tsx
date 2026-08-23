import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { Box, Callout, Card, Flex, Text } from "@radix-ui/themes";
import { type PropsWithChildren } from "react";
import { useEntitlement } from "./use-entitlement";
import { isAdmin } from "./authorization";

export function AccessBoundary({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const entitlement = useEntitlement();

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

  const expired = !isAdmin(user) && entitlement?.status === "expired";
  return (
    <>
      {expired && (
        <Callout.Root color="amber" m="3" dir="rtl">
          <Callout.Text>اشتراک منقضی شده است؛ اطلاعات قابل مشاهده‌اند اما تغییرات جدید تا تمدید اشتراک غیرفعال هستند.</Callout.Text>
        </Callout.Root>
      )}
      {expired ? <Box asChild><fieldset disabled className="contents">{children}</fieldset></Box> : children}
    </>
  );
}
