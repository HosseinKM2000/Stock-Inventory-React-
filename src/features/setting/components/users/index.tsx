import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { Badge, Box, Callout, Card, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { toast } from "sonner";
import {
  useAdminPlans,
  useAdminUsers,
  useDeleteUser,
  useSetUserActive,
  useSetUserRole,
  useSetUserSubscription,
} from "../../mutations/use-admin";
import { adminErrorMessage } from "../admin-error";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("fa-IR").format(new Date(value)) : "—";

export default function UsersSettings() {
  const { user: current } = useAuth();
  const users = useAdminUsers();
  const plans = useAdminPlans();
  const account = useSetUserActive();
  const role = useSetUserRole();
  const subscription = useSetUserSubscription();
  const remove = useDeleteUser();

  const run = <T,>(promise: Promise<T>, message: string) => {
    void promise.then(() => toast.success(message)).catch((error: unknown) =>
      toast.error(adminErrorMessage(error, "عملیات ناموفق بود")));
  };

  if (users.isLoading) return <Spinner size="3" />;
  if (users.isError) return <Callout.Root color="red"><Callout.Text>دریافت کاربران ناموفق بود.</Callout.Text></Callout.Root>;

  return (
    <Box>
      <Text size="6" weight="bold">کاربران</Text>
      <Flex direction="column" gap="3" mt="5">
        {(users.data ?? []).map((user) => {
          const immutable = user.is_system_admin;
          const self = user.id === current?.id;
          return (
            <Card key={user.id}>
              <Flex justify="between" align="start" gap="4" wrap="wrap">
                <Box className="min-w-0 flex-1">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text size="4" weight="bold">{user.first_name} {user.last_name}</Text>
                    <Badge color={user.is_active ? "green" : "red"}>{user.is_active ? "فعال" : "غیرفعال"}</Badge>
                    <Badge color={user.role === "ADMIN" ? "violet" : "gray"}>{user.role}</Badge>
                    {immutable && <Badge color="amber">مدیر دائمی سیستم</Badge>}
                  </Flex>
                  <Text as="div" size="2" color="gray" mt="2">@{user.username} · {user.email || "بدون ایمیل"} · {user.phone || "بدون تلفن"}</Text>
                  <Box mt="3" className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <Text>اشتراک: {user.plan} ({user.subscription_status === "active" ? "فعال" : "منقضی"})</Text>
                    <Text>شروع: {date(user.subscription_started_at)}</Text>
                    <Text>انقضا: {date(user.subscription_expires_at)}</Text>
                    <Text>باقی‌مانده: {user.remaining_days == null ? "—" : `${user.remaining_days} روز`}</Text>
                    <Text>ثبت‌نام: {date(user.created_at)}</Text>
                    <Text>آخرین فعالیت: {date(user.last_activity_at)}</Text>
                  </Box>
                </Box>

                <Flex direction="column" gap="2" className="w-full sm:w-56">
                  <Select.Root
                    value={user.plan}
                    disabled={subscription.isPending}
                    onValueChange={(plan) => run(subscription.mutateAsync({ id: user.id, plan }), "اشتراک به‌روزرسانی شد")}
                  >
                    <Select.Trigger />
                    <Select.Content>{(plans.data ?? []).filter((plan) => plan.is_active || plan.id === user.plan).map((plan) => <Select.Item key={plan.id} value={plan.id}>{plan.name}</Select.Item>)}</Select.Content>
                  </Select.Root>
                  <Flex gap="2" wrap="wrap">
                    <Button
                      size="2"
                      variant="soft"
                      disabled={immutable || self}
                      onClick={() => run(role.mutateAsync({ id: user.id, role: user.role === "ADMIN" ? "USER" : "ADMIN" }), "نقش کاربر تغییر کرد")}
                    >{user.role === "ADMIN" ? "لغو مدیریت" : "اعطای مدیریت"}</Button>
                    <Button
                      size="2"
                      color={user.is_active ? "red" : "green"}
                      variant="soft"
                      disabled={immutable || self}
                      onClick={() => run(account.mutateAsync({ id: user.id, active: !user.is_active }), "وضعیت حساب تغییر کرد")}
                    >{user.is_active ? "غیرفعال" : "فعال"}</Button>
                    <Button
                      size="2"
                      color="red"
                      variant="outline"
                      disabled={immutable || self}
                      onClick={() => {
                        if (confirm(`کاربر ${user.username} حذف شود؟`)) run(remove.mutateAsync(user.id), "کاربر حذف شد");
                      }}
                    >حذف</Button>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          );
        })}
      </Flex>
    </Box>
  );
}
