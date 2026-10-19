import { Button } from "@/shared/ui/button/button";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Badge, Box, Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { InventoryNotification } from "../types";

export function NotificationItem({ item, onNavigate }: { item: InventoryNotification; onNavigate: () => void }) {
  const critical = item.severity === "critical";
  return (
    <Card size="1">
      <Flex gap="3" align="start">
        <Box className={`mt-1 shrink-0 ${critical ? "text-red-500" : "text-amber-500"}`}>
          <ExclamationTriangleIcon width="18" height="18" />
        </Box>
        <Box className="min-w-0 flex-1">
          <Flex justify="between" align="center" gap="2" wrap="wrap">
            <Text size="2" weight="bold">{item.title}</Text>
            <Badge color={critical ? "red" : "amber"}>{critical ? "بحرانی" : "هشدار"}</Badge>
          </Flex>
          <Text as="div" size="2" mt="2">{item.description}</Text>
          <Text as="div" size="1" color="gray" mt="1">{item.context}</Text>
          <Link to="/inventory/edit" search={{ id: item.productId }} onClick={onNavigate}>
            <Button size="2" variant="soft" mt="3" className="w-full sm:w-auto">مشاهده و ویرایش محصول</Button>
          </Link>
        </Box>
      </Flex>
    </Card>
  );
}
