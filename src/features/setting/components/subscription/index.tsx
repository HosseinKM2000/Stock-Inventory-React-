import { apiFetch } from "@/shared/api/client";
import { useEntitlement } from "@/shared/access/use-entitlement";
import { useQuery } from "@tanstack/react-query";
import { Badge, Box, Card, Flex, Grid, Text } from "@radix-ui/themes";

type Plan = {
  id: string;
  label: string;
  price_minor: number | null;
  currency: string;
  duration_days: number | null;
  capabilities: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export default function SubscriptionSettings() {
  const current = useEntitlement();
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => apiFetch<Plan[]>("/plans") });
  return (
    <Box>
      <Text size="6" weight="bold">اشتراک</Text>
      <Text as="div" color="gray" mt="2">
        طرح فعلی: {current?.label ?? "—"} · {current?.status === "expired" ? "منقضی" : "فعال"}
      </Text>
      <Grid columns={{ initial: "1", md: "2" }} gap="4" mt="5">
        {(plans.data ?? []).map((plan) => (
          <Card key={plan.id}>
            <Flex justify="between" align="center">
              <Text size="5" weight="bold">{plan.label}</Text>
              {current?.plan === plan.id && <Badge color="violet">طرح فعلی</Badge>}
            </Flex>
            <Text as="div" size="2" color="gray" mt="3">
              سقف کالا: {plan.limits.inventory_items ?? "نامحدود"} · دستگاه: {plan.limits.devices ?? "نامحدود"}
            </Text>
            <Text as="div" size="2" color="gray" mt="2">
              {plan.price_minor == null ? "قیمت‌گذاری هنوز فعال نشده" : plan.price_minor === 0 ? "رایگان" : `${plan.price_minor} ${plan.currency}`}
            </Text>
          </Card>
        ))}
      </Grid>
      <Text as="div" size="2" color="gray" mt="4">خرید و پرداخت در فاز بعدی فعال خواهد شد.</Text>
    </Box>
  );
}
