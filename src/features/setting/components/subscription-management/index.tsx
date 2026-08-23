import { Button } from "@/shared/ui/button/button";
import { Badge, Box, Callout, Card, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";
import { useAdminPlans } from "../../mutations/use-admin";
import PlanDialog from "./plan-dialog";
import SubscribersDialog from "./subscribers-dialog";

export default function SubscriptionManagement() {
  const plans = useAdminPlans();
  if (plans.isLoading) return <Spinner size="3" />;
  if (plans.isError) return <Callout.Root color="red"><Callout.Text>دریافت طرح‌ها ناموفق بود.</Callout.Text></Callout.Root>;
  return (
    <Box>
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Box><Text size="6" weight="bold">مدیریت اشتراک‌ها</Text><Text as="div" size="2" color="gray" mt="1">قیمت‌ها و حدود تجاری را فقط مطابق قرارداد کسب‌وکار وارد کنید.</Text></Box>
        <PlanDialog trigger={<Button><PlusIcon />طرح جدید</Button>} />
      </Flex>
      <Grid columns={{ initial: "1", md: "2" }} gap="4" mt="5">
        {(plans.data ?? []).map((plan) => (
          <Card key={plan.id}>
            <Flex justify="between" align="center"><Text size="5" weight="bold">{plan.name}</Text><Badge color={plan.is_active ? "green" : "gray"}>{plan.is_active ? "فعال" : "غیرفعال"}</Badge></Flex>
            <Text as="div" color="gray" size="2" mt="2">{plan.description || "بدون توضیحات"}</Text>
            <Text as="div" size="2" mt="3">قیمت: {plan.price_minor == null ? "تعیین نشده" : `${plan.price_minor} ${plan.currency}`}</Text>
            <Text as="div" size="2">مدت: {plan.duration == null ? "دائمی" : `${plan.duration} ${plan.duration_unit}`}</Text>
            <Text as="div" size="2">امکانات فعال: {Object.values(plan.features).filter(Boolean).length} · محدودیت‌ها: {Object.keys(plan.limits).length}</Text>
            <Flex justify="end" gap="2" mt="4"><SubscribersDialog planId={plan.id} /><PlanDialog plan={plan} trigger={<Button size="2" variant="soft">ویرایش</Button>} /></Flex>
          </Card>
        ))}
      </Grid>
    </Box>
  );
}
