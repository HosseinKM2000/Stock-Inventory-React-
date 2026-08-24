import type { AdminUser } from "@/features/auth/types";
import { useAuth } from "@/shared/auth/use-auth";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Badge, Box, Callout, Card, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAdminPlans, useAdminUsers, useDeleteUser, useSetUserActive,
  useSetUserRole, useSetUserSubscription,
} from "../../mutations/use-admin";
import { adminErrorMessage } from "../admin-error";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("fa-IR").format(new Date(value)) : "—";

type PendingAction =
  | { kind: "subscription"; user: AdminUser; plan: string; planName: string }
  | { kind: "role"; user: AdminUser; role: "USER" | "ADMIN" }
  | { kind: "state"; user: AdminUser; active: boolean }
  | { kind: "delete"; user: AdminUser };

function actionCopy(action: PendingAction | null) {
  if (!action) return null;
  const name = `${action.user.first_name} ${action.user.last_name} (@${action.user.username})`;
  if (action.kind === "subscription") return {
    title: "تغییر اشتراک کاربر",
    description: `اشتراک ${name} از طرح «${action.user.plan}» به «${action.planName}» تغییر می‌کند و دسترسی‌ها بلافاصله به‌روزرسانی می‌شوند.`,
    label: "تغییر اشتراک", variant: "warning" as const,
  };
  if (action.kind === "role") return action.role === "ADMIN" ? {
    title: "اعطای دسترسی مدیریت",
    description: `${name} به همه بخش‌های مدیریتی، کاربران، طرح‌ها و کاتالوگ دسترسی خواهد داشت.`,
    label: "اعطای مدیریت", variant: "warning" as const,
  } : {
    title: "لغو دسترسی مدیریت",
    description: `${name} دیگر به بخش‌های مدیریتی دسترسی نخواهد داشت و فقط مجوزهای اشتراک خود را خواهد داشت.`,
    label: "لغو مدیریت", variant: "danger" as const,
  };
  if (action.kind === "state") return action.active ? {
    title: "فعال‌سازی دوباره حساب",
    description: `${name} دوباره می‌تواند وارد برنامه شود و از امکانات مجاز حساب استفاده کند.`,
    label: "فعال‌سازی حساب", variant: "success" as const,
  } : {
    title: "غیرفعال‌سازی حساب",
    description: `${name} فوراً از همه نشست‌ها خارج می‌شود و تا فعال‌سازی دوباره قادر به استفاده از برنامه نیست.`,
    label: "غیرفعال‌سازی حساب", variant: "danger" as const,
  };
  return {
    title: "حذف دائمی کاربر",
    description: `حساب ${name} و داده‌های وابسته آن به‌صورت دائمی حذف می‌شوند. این عملیات قابل بازگشت نیست.`,
    label: "حذف دائمی", variant: "danger" as const,
  };
}

export default function UsersSettings() {
  const { user: current } = useAuth();
  const users = useAdminUsers();
  const plans = useAdminPlans();
  const account = useSetUserActive();
  const role = useSetUserRole();
  const subscription = useSetUserSubscription();
  const remove = useDeleteUser();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const loading = account.isPending || role.isPending || subscription.isPending || remove.isPending;
  const copy = actionCopy(pendingAction);

  async function confirmAction() {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === "subscription") {
        await subscription.mutateAsync({ id: pendingAction.user.id, plan: pendingAction.plan });
        toast.success("اشتراک کاربر به‌روزرسانی شد");
      } else if (pendingAction.kind === "role") {
        await role.mutateAsync({ id: pendingAction.user.id, role: pendingAction.role });
        toast.success("نقش کاربر تغییر کرد");
      } else if (pendingAction.kind === "state") {
        await account.mutateAsync({ id: pendingAction.user.id, active: pendingAction.active });
        toast.success("وضعیت حساب تغییر کرد");
      } else {
        await remove.mutateAsync(pendingAction.user.id);
        toast.success("کاربر حذف شد");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(adminErrorMessage(error, "عملیات ناموفق بود"));
    }
  }

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
                <Flex direction="column" gap="2" className="w-full sm:w-60">
                  <Select.Root value={user.plan} disabled={loading} onValueChange={(planId) => {
                    const selected = (plans.data ?? []).find((plan) => plan.id === planId);
                    if (selected && planId !== user.plan) setPendingAction({ kind: "subscription", user, plan: planId, planName: selected.name });
                  }}>
                    <Select.Trigger aria-label={`طرح اشتراک ${user.username}`} />
                    <Select.Content>{(plans.data ?? []).filter((plan) => plan.is_active || plan.id === user.plan).map((plan) => <Select.Item key={plan.id} value={plan.id}>{plan.name}</Select.Item>)}</Select.Content>
                  </Select.Root>
                  <Flex gap="2" wrap="wrap">
                    <Button size="2" variant="soft" disabled={immutable || self || loading} onClick={() => setPendingAction({ kind: "role", user, role: user.role === "ADMIN" ? "USER" : "ADMIN" })}>{user.role === "ADMIN" ? "لغو مدیریت" : "اعطای مدیریت"}</Button>
                    <Button size="2" color={user.is_active ? "red" : "green"} variant="soft" disabled={immutable || self || loading} onClick={() => setPendingAction({ kind: "state", user, active: !user.is_active })}>{user.is_active ? "غیرفعال" : "فعال"}</Button>
                    <Button size="2" color="red" variant="outline" disabled={immutable || self || loading} onClick={() => setPendingAction({ kind: "delete", user })}>حذف</Button>
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          );
        })}
      </Flex>
      {copy && <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.label}
        variant={copy.variant}
        loading={loading}
        onConfirm={() => { void confirmAction(); }}
      />}
    </Box>
  );
}
