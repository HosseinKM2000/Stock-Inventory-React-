import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { listUsers, setUserActive } from "../../api/users.api";

export default function UsersSettings() {
  const { user: current } = useAuth();
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: listUsers });
  const state = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setUserActive(id, active),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  if (users.isLoading) return <Spinner size="3" />;
  return (
    <Box>
      <Text size="6" weight="bold">کاربران</Text>
      <Flex direction="column" gap="3" mt="5">
        {(users.data ?? []).map((user) => (
          <Card key={user.id}>
            <Flex justify="between" align="center" gap="3" wrap="wrap">
              <Box>
                <Text as="div" weight="bold">{user.first_name} {user.last_name}</Text>
                <Text as="div" size="2" color="gray">@{user.username} · {user.plan} · {user.is_active ? "فعال" : "غیرفعال"}</Text>
              </Box>
              <Button
                color={user.is_active ? "red" : "green"}
                variant="soft"
                disabled={user.id === current?.id}
                loading={state.isPending && state.variables?.id === user.id}
                onClick={() => state.mutate({ id: user.id, active: !user.is_active })}
              >
                {user.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
              </Button>
            </Flex>
          </Card>
        ))}
      </Flex>
    </Box>
  );
}
