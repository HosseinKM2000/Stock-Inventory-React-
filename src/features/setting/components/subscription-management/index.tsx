import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { CheckCircledIcon, ClockIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Flex, Grid, Separator, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import { useAdminPlans, useDeletePlan } from "../../mutations/use-admin";
import type { SubscriptionPlan } from "../../types";
import { adminErrorMessage } from "../admin-error";
import PlanDialog from "./plan-dialog";
import { FEATURE_LABELS, formatToman } from "./plan-options";
import SubscribersDialog from "./subscribers-dialog";

const builtInPlans = new Set(["free", "starter", "pro", "vip"]);
const durationLabels = { day: "روز", month: "ماه", year: "سال" } as const;

export default function SubscriptionManagement() {
  const plans = useAdminPlans();
  const remove = useDeletePlan();
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);

  async function deleteSelected() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("طرح اشتراک حذف شد");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(adminErrorMessage(error, "حذف طرح ناموفق بود"));
    }
  }

  if (plans.isLoading) return <Spinner size="3" />;
  if (plans.isError) return <Callout.Root color="red"><Callout.Text>دریافت طرح‌ها ناموفق بود.</Callout.Text></Callout.Root>;
  return (
    <Box>
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Box><Text size="6" weight="bold">مدیریت اشتراک‌ها</Text><Text as="div" size="2" color="gray" mt="1">قیمت‌ها به تومان نمایش داده می‌شوند و تغییر قابلیت‌ها فوراً در مجوزهای سرور اعمال می‌شود.</Text></Box>
        <PlanDialog trigger={<Button><PlusIcon />طرح جدید</Button>} />
      </Flex>
      <Grid columns={{ initial: "1", md: "2", xl: "3" }} gap="4" mt="5">
        {(plans.data ?? []).map((plan) => {
          const enabled = Object.entries(plan.features).filter(([, value]) => value);
          return <Card key={plan.id} className="flex min-h-80 flex-col">
            <Flex justify="between" align="start" gap="3">
              <Box className="min-w-0"><Text size="5" weight="bold">{plan.name}</Text><Text as="div" size="1" color="gray">{plan.id}</Text></Box>
              <Badge color={plan.is_active ? "green" : "gray"}>{plan.is_active ? "فعال" : "غیرفعال"}</Badge>
            </Flex>
            <Text as="div" color="gray" size="2" mt="3" className="min-h-10">{plan.description || "بدون توضیحات"}</Text>
            <Flex align="center" gap="2" mt="4"><Text size="5" weight="bold" color="violet">{formatToman(plan.price_minor)}</Text></Flex>
            <Flex align="center" gap="2" mt="2"><ClockIcon /><Text size="2">{plan.duration == null || plan.duration_unit == null ? "بدون انقضا" : `${plan.duration} ${durationLabels[plan.duration_unit]}`}</Text></Flex>
            <Separator size="4" my="4" />
            <Text size="2" weight="bold">قابلیت‌های فعال ({enabled.length})</Text>
            <Flex direction="column" gap="1" mt="2" className="flex-1">
              {enabled.slice(0, 5).map(([key]) => <Flex key={key} align="center" gap="2"><CheckCircledIcon color="var(--green-9)" /><Text size="2">{FEATURE_LABELS[key] ?? key}</Text></Flex>)}
              {enabled.length > 5 && <Text size="1" color="gray">و {enabled.length - 5} قابلیت دیگر</Text>}
            </Flex>
            <Flex justify="end" gap="2" mt="5" wrap="wrap">
              <SubscribersDialog planId={plan.id} />
              <PlanDialog plan={plan} trigger={<Button size="2" variant="soft">ویرایش</Button>} />
              <Button size="2" variant="outline" color="red" disabled={builtInPlans.has(plan.id)} title={builtInPlans.has(plan.id) ? "طرح پیش‌فرض سیستم قابل حذف نیست" : undefined} onClick={() => setDeleteTarget(plan)}><TrashIcon />حذف</Button>
            </Flex>
          </Card>;
        })}
      </Grid>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="حذف طرح اشتراک"
        description={`طرح «${deleteTarget?.name ?? ""}» حذف می‌شود. اگر کاربری عضو آن باشد، سرور از حذف جلوگیری می‌کند.`}
        confirmLabel="حذف طرح"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => { void deleteSelected(); }}
      />
    </Box>
  );
}
