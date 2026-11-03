import { Button } from "@/shared/ui/button/button";
import { CrossCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { AppNotification } from "../types";

export function NotificationItem({ item, onNavigate }: { item: AppNotification; onNavigate: () => void }) {
  const critical = item.severity === "critical";
  const informational = item.severity === "info";
  const StatusIcon = critical ? CrossCircledIcon : informational ? InfoCircledIcon : ExclamationTriangleIcon;
  const label = critical ? "بحرانی" : informational ? "اطلاع‌رسانی" : "هشدار";

  return (
    <Card size="1" className="app-notification-card" data-severity={item.severity}>
      <Flex gap="3" align="start" className="app-notification-layout">
        <Box className="app-notification-icon shrink-0" aria-hidden="true"><StatusIcon width="20" height="20" /></Box>
        <Box className="min-w-0 flex-1">
          <Flex justify="between" align="start" gap="2" wrap="wrap">
            <Text size="2" weight="bold" className="app-notification-title">{item.title}</Text>
            <Badge color={critical ? "red" : informational ? "violet" : "amber"} variant="soft" radius="full">{label}</Badge>
          </Flex>
          <Text as="div" size="2" mt="2" className="app-notification-description">{item.description}</Text>
          <Text as="div" size="1" color="gray" mt="1" className="app-notification-context">{item.context}</Text>
          {"productId" in item ? (
            <Link to="/inventory/edit" search={{ id: item.productId }} onClick={onNavigate}>
              <Button size="2" variant="soft" mt="3" className="app-notification-action w-full sm:w-auto">مشاهده و ویرایش محصول</Button>
            </Link>
          ) : (
            <Link to={item.route} onClick={onNavigate}>
              <Button size="2" variant="soft" mt="3" className="app-notification-action w-full sm:w-auto">
                {item.kind === "profile_completion" ? "تکمیل پروفایل" : item.kind === "app_update_ready" ? "مشاهده و نصب بروزرسانی" : "باز کردن تنظیمات فایل پشتیبان"}
              </Button>
            </Link>
          )}
        </Box>
      </Flex>
    </Card>
  );
}
