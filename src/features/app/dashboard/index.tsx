import {
  Cross1Icon,
  ExclamationTriangleIcon,
  IdCardIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import {
  Avatar,
  Badge,
  Box,
  Callout,
  Card,
  Flex,
  Grid,
  Skeleton,
  Text,
} from "@radix-ui/themes";
import { useDashboardStats } from "./hooks/use-dashboard";
import Chart from "./chart";

const DashboardComponents = () => {
  const { data, isLoading, isError } = useDashboardStats();

  const cards = [
    {
      label: "مجموع کالاها",
      value: data ? data.total_products.toLocaleString("fa-IR") : "0",
      icon: <MixIcon />,
      color: "indigo" as const,
      badge: null,
    },
    {
      label: "کمبود موجودی",
      value: data ? data.low_stock_count.toLocaleString("fa-IR") : "0",
      icon: <ExclamationTriangleIcon />,
      color: "yellow" as const,
      badge: { text: "نیاز به اقدام", color: "yellow" as const },
    },
    {
      label: "عدم موجودی",
      value: data ? data.out_of_stock_count.toLocaleString("fa-IR") : "0",
      icon: <Cross1Icon />,
      color: "red" as const,
      badge: { text: "فوری", color: "red" as const },
    },
    {
      label: "ارزش موجودی",
      value: data
        ? `${data.inventory_value.toLocaleString("fa-IR")} تومان`
        : "0",
      icon: <IdCardIcon />,
      color: "green" as const,
      badge: null,
    },
  ];

  return (
    <main className="container mx-auto">
      <Flex direction={"column"} gapY={"2"}>
        <Text size={"7"} weight={"bold"}>
          داشبورد
        </Text>
        <Text size={"3"} weight={"light"}>
          نمایش وضعیت لحظه ای موجودی اقلام شما.
        </Text>
      </Flex>

      {isError && (
        <Callout.Root color="red" dir="rtl" mt="5">
          <Callout.Text>خطا در دریافت اطلاعات داشبورد</Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ xs: "1", md: "4" }} gap={"5"} mt={"5"}>
        {cards.map((card) => (
          <Grid key={card.label}>
            <Card size="2">
              <Flex gap="3" align="start" justify={"between"}>
                <Avatar
                  size="3"
                  radius="full"
                  fallback={card.icon}
                  color={card.color}
                />
                {card.badge && (
                  <Badge color={card.badge.color}>{card.badge.text}</Badge>
                )}
              </Flex>
              <Box mt={"3"}>
                <Text as="div" size="2" color="gray">
                  {card.label}
                </Text>
                <Skeleton loading={isLoading}>
                  <Text as="div" size="2" weight="bold" mt={"1"}>
                    {card.value}
                  </Text>
                </Skeleton>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box width={"100%"} mt={"5"}>
        <Chart data={data?.category_breakdown ?? []} />
      </Box>
    </main>
  );
};

export default DashboardComponents;
