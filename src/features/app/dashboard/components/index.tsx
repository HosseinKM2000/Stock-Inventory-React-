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

import { useNavigate } from "@tanstack/react-router";
import { dashboardCards } from "../data/dashboard-cards";
import { useDashboardStats } from "../mutations/use-dashboard";
import type { DashboardStats } from "../types";

const DashboardComponent = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading, isError } = useDashboardStats();

  return (
    <main className="app-responsive-page container mx-auto p-4 md:p-6">
      <Flex direction="column" gap="2">
        <Text size="7" weight="bold">
          داشبورد
        </Text>

        <Text size="3" color="gray">
          نمایش وضعیت لحظه‌ای موجودی انبار
        </Text>
      </Flex>

      {isError && (
        <Callout.Root color="red" dir="rtl" mt="5">
          <Callout.Text>خطا در دریافت اطلاعات داشبورد</Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="4" mt="5">
        {dashboardCards.map((card) => (
          <Card
            key={card.label}
            size="2"
            className={`${card.filter ? "cursor-pointer" : ""} transition-all hover:shadow-lg`}
            onClick={() =>
              card.filter &&
              navigate({ to: `/dashboard/products/${card.filter}` })
            }
          >
            <Flex justify="between" align="start">
              <Avatar
                size="3"
                radius="full"
                fallback={<card.icon />}
                color={card.color}
              />

              {card.badge && (
                <Badge color={card.badge.color}>{card.badge.text}</Badge>
              )}
            </Flex>

            <Box mt="3">
              <Text as="div" size="2" color="gray">
                {card.label}
              </Text>

              <Skeleton loading={isLoading}>
                <Text as="div" mt="1" size="5" weight="bold">
                  {card.value(stats as DashboardStats)}
                </Text>
              </Skeleton>
            </Box>
          </Card>
        ))}
      </Grid>
    </main>
  );
};

export default DashboardComponent;
