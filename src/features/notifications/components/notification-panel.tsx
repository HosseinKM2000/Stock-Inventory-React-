import { BellIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { Badge, Box, Flex, IconButton, Popover, ScrollArea, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { useNotifications } from "../hooks/use-notifications";
import { NotificationItem } from "./notification-item";

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const { notifications, count, isLoading, isError } = useNotifications();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <IconButton size="3" variant="ghost" color="gray" aria-label={count ? `${count} هشدار فعال` : "اعلان‌ها"}>
          <span className="relative inline-flex h-5.5 w-5.5 items-center justify-center">
            <BellIcon width="22" height="22" />
            {count > 0 ? (
              <Badge size="1" color="red" variant="solid" radius="full" className="notification-count-badge pointer-events-none absolute! z-10 justify-center px-1! leading-none">
                {count > 99 ? "۹۹+" : count.toLocaleString("fa-IR")}
              </Badge>
            ) : null}
          </span>
        </IconButton>
      </Popover.Trigger>
      <Popover.Content dir="rtl" align="start" sideOffset={8} className="notification-popover w-[min(26rem,calc(100dvw-1rem))] p-0!">
        <Box p="4" className="notification-popover-header">
          <Flex align="center" justify="between" gap="3">
            <Box>
              <Text size="4" weight="bold">هشدارها</Text>
              <Text as="div" size="1" color="gray" mt="1">موارد نیازمند توجه تا زمان رفع مشکل در اینجا باقی می‌مانند.</Text>
            </Box>
            {count > 0 ? <Badge color="red" variant="soft" radius="full">{count.toLocaleString("fa-IR")}</Badge> : null}
          </Flex>
        </Box>
        <ScrollArea type="auto" scrollbars="vertical" className="notification-scroll-area max-h-[min(65dvh,32rem)]">
          <Flex direction="column" gap="3" p="3">
            {isLoading ? <Flex justify="center" py="6"><Spinner /></Flex> : null}
            {isError ? <Text color="red" size="2" className="notification-panel-message">دریافت هشدارها ناموفق بود.</Text> : null}
            {!isLoading && !isError && notifications.length === 0 ? (
              <Box py="6" className="notification-empty-state text-center">
                <span className="notification-empty-icon" aria-hidden="true"><CheckCircledIcon width="22" height="22" /></span>
                <Text as="div" size="2" weight="medium" mt="3">همه‌چیز مرتب است</Text>
                <Text as="div" size="1" color="gray" mt="1">هشدار فعالی وجود ندارد.</Text>
              </Box>
            ) : null}
            {notifications.map((item) => <NotificationItem key={item.id} item={item} onNavigate={() => setOpen(false)} />)}
          </Flex>
        </ScrollArea>
      </Popover.Content>
    </Popover.Root>
  );
}
