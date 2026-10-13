import { BellIcon } from "@radix-ui/react-icons";
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
              <Badge size="1" color="red" variant="solid" radius="full" className="pointer-events-none absolute! z-10 justify-center px-1! leading-none" style={{ top: -5, right: -9, minWidth: 18, height: 18 }}>
                {count > 99 ? "۹۹+" : count.toLocaleString("fa-IR")}
              </Badge>
            ) : null}
          </span>
        </IconButton>
      </Popover.Trigger>
      <Popover.Content dir="rtl" align="start" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] p-0!">
        <Box p="4" className="border-b border-foreground/10">
          <Text size="4" weight="bold">هشدارها</Text>
          <Text as="div" size="1" color="gray" mt="1">موارد نیازمند توجه تا زمان رفع مشکل در اینجا باقی می‌مانند.</Text>
        </Box>
        <ScrollArea type="auto" scrollbars="vertical" className="max-h-[min(65dvh,32rem)]">
          <Flex direction="column" gap="2" p="3">
            {isLoading ? <Flex justify="center" py="6"><Spinner /></Flex> : null}
            {isError ? <Text color="red" size="2">دریافت هشدارها ناموفق بود.</Text> : null}
            {!isLoading && !isError && notifications.length === 0 ? (
              <Box py="6" className="text-center">
                <BellIcon width="24" height="24" className="mx-auto text-foreground/40" />
                <Text as="div" size="2" color="gray" mt="2">هشدار فعالی وجود ندارد.</Text>
              </Box>
            ) : null}
            {notifications.map((item) => <NotificationItem key={item.id} item={item} onNavigate={() => setOpen(false)} />)}
          </Flex>
        </ScrollArea>
      </Popover.Content>
    </Popover.Root>
  );
}
