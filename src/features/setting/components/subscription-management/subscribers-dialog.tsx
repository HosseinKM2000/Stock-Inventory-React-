import { Button } from "@/shared/ui/button/button";
import { Badge, Dialog, Flex, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { usePlanSubscribers } from "../../mutations/use-admin";

export default function SubscribersDialog({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const subscribers = usePlanSubscribers(planId, open);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button size="2" variant="outline">مشاهده مشترکان</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="560px" dir="rtl">
        <Dialog.Title>مشترکان طرح</Dialog.Title>
        <Flex direction="column" gap="2" mt="4">
          {subscribers.isLoading && <Spinner />}
          {subscribers.isError && <Text color="red">دریافت مشترکان ناموفق بود.</Text>}
          {subscribers.data?.length === 0 && <Text color="gray">کاربری در این طرح نیست.</Text>}
          {subscribers.data?.map((user) => (
            <Flex key={user.id} justify="between" align="center" gap="3" p="2" className="rounded-md border">
              <Text className="min-w-0 truncate">{user.first_name} {user.last_name} (@{user.username})</Text>
              <Badge color={user.is_active ? "green" : "red"}>{user.is_active ? "فعال" : "غیرفعال"}</Badge>
            </Flex>
          ))}
        </Flex>
        <Flex justify="end" mt="5"><Dialog.Close><Button variant="soft">بستن</Button></Dialog.Close></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
