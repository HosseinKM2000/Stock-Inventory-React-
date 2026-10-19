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

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { accessState } from "@/shared/access/access-state";
import {
  consumeDashboardReturnAnchor,
  rememberDashboardReturnAnchor,
} from "@/shared/lib/navigation/scroll-restoration";
import { dashboardCards } from "../data/dashboard-cards";
import { useDashboardStats } from "../mutations/use-dashboard";
import type { DashboardStats } from "../types";
import { useQuery } from "@tanstack/react-query";
import { personnelApi } from "@/features/personnel/api";
import { isAdmin } from "@/shared/access/authorization";

const DashboardComponent = () => {
  const navigate = useNavigate();
  const user = accessState.user();
  const userId = user?.id;
  const isOwner = user?.is_store_owner === true || isAdmin(user);

  const { data: stats, isLoading, isError } = useDashboardStats();

  useEffect(() => {
    const anchorId = consumeDashboardReturnAnchor(userId);
    if (anchorId) document.getElementById(anchorId)?.scrollIntoView({ block: "center" });
  }, [userId]);

  const openCard = (card: (typeof dashboardCards)[number]) => {
    rememberDashboardReturnAnchor(userId, `dashboard-section-${card.id}`);
    void navigate({ to: card.to });
  };

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
        {isOwner ? <TodayActivityCard /> : null}
        {dashboardCards.map((card) => (
          <Card
            key={card.id}
            id={`dashboard-section-${card.id}`}
            size="2"
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all hover:shadow-lg"
            onClick={() => openCard(card)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCard(card);
              }
            }}
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
                  {card.value((stats ?? {
                    totalProducts: 0, inventoryValue: 0, lowStockCount: 0,
                    outOfStockCount: 0, hiddenCount: 0, noImageCount: 0,
                    noPriceCount: 0, urgentPurchaseCount: 0, addedTodayCount: 0,
                    missingClassificationCount: 0, valuedProductsCount: 0,
                    todayActionCount: 0,
                  }) as DashboardStats)}
                </Text>
              </Skeleton>
            </Box>
          </Card>
        ))}
      </Grid>
    </main>
  );
};

function TodayActivityCard() {
  const activity = useQuery({ queryKey: ["store-activity-today"], queryFn: personnelApi.todayActivity });
  return <Card asChild size="2"><Link to="/tools/activity" className="block"><Text as="div" size="2" color="gray">فعالیت امروز مجموعه</Text><Text as="div" mt="1" size="5" weight="bold">{activity.data?.count ?? 0}</Text><Text as="div" mt="2" size="1" color="gray">مشاهده تاریخچه</Text></Link></Card>;
}

export default DashboardComponent;
