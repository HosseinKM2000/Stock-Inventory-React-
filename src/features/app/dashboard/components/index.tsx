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
  const storeId = user?.store_id;

  const { data: stats, isLoading, isError } = useDashboardStats();

  useEffect(() => {
    const anchorId = consumeDashboardReturnAnchor(userId, storeId);
    if (anchorId) document.getElementById(anchorId)?.scrollIntoView({ block: "center" });
  }, [storeId, userId]);

  const openCard = (card: (typeof dashboardCards)[number]) => {
    rememberDashboardReturnAnchor(userId, `dashboard-section-${card.id}`, storeId);
    void navigate({ to: card.to });
  };

  const visibleCards = dashboardCards.filter((card) =>
    (!card.permission || accessState.hasStorePermission(card.permission)) &&
    (!card.capabilities || card.capabilities.some((capability) => accessState.canUse(capability))),
  );
  const groups = [
    { title: "نمای کلی", ids: new Set(["all", "out-of-stock", "low-stock", "urgent-purchase", "no-price"]) },
    { title: "اقدام‌های اولویت‌دار", ids: new Set(["actions"]) },
    { title: "تحلیل موجودی و فاکتورها", ids: new Set(["invoice-reports", "financial", "highest-value", "inventory-value"]) },
    { title: "تکمیل اطلاعات", ids: new Set(["unclassified", "no-image", "today", "hidden"]) },
  ];

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

      {groups.map((group) => {
        const cards = visibleCards.filter((card) => group.ids.has(card.id));
        if (cards.length === 0) return null;
        return <section key={group.title} className="mt-6" aria-label={group.title}>
          <Text as="div" role="heading" aria-level={2} size="4" weight="bold" mb="3">{group.title}</Text>
          <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="4">
            {cards.map((card) => <DashboardSummaryCard key={card.id} card={card} stats={stats} loading={isLoading} onOpen={openCard} />)}
            {group.title === "تکمیل اطلاعات" && isOwner ? <TodayActivityCard /> : null}
          </Grid>
        </section>;
      })}
    </main>
  );
};

const emptyStats: DashboardStats = {
  totalProducts: 0, inventoryValue: 0, lowStockCount: 0, outOfStockCount: 0, hiddenCount: 0,
  noImageCount: 0, noPriceCount: 0, urgentPurchaseCount: 0, addedTodayCount: 0,
  missingClassificationCount: 0, valuedProductsCount: 0, todayActionCount: 0,
};

function DashboardSummaryCard({ card, stats, loading, onOpen }: { card: (typeof dashboardCards)[number]; stats: DashboardStats | undefined; loading: boolean; onOpen(card: (typeof dashboardCards)[number]): void }) {
  const urgent = card.id === "out-of-stock" || card.id === "urgent-purchase";
  return <Card id={`dashboard-section-${card.id}`} size="2" role="button" tabIndex={0} data-priority={urgent ? "urgent" : "normal"} className={urgent ? "cursor-pointer border-red-7 bg-red-2 transition-colors hover:bg-red-3" : "cursor-pointer transition-colors hover:bg-[var(--accent-a2)]"} onClick={() => onOpen(card)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(card); } }}>
    <Flex justify="between" align="start"><Avatar size="3" radius="full" fallback={<card.icon />} color={card.color} />{card.badge ? <Badge color={card.badge.color}>{card.badge.text}</Badge> : null}</Flex>
    <Box mt="3"><Text as="div" size="2" color="gray">{card.label}</Text><Skeleton loading={loading}><Text as="div" mt="1" size="5" weight="bold">{card.value(stats ?? emptyStats)}</Text></Skeleton></Box>
  </Card>;
}

function TodayActivityCard() {
  const activity = useQuery({ queryKey: ["store-activity-today"], queryFn: personnelApi.todayActivity });
  return <Card asChild size="2"><Link to="/tools/activity" className="block"><Text as="div" size="2" color="gray">فعالیت امروز مجموعه</Text><Text as="div" mt="1" size="5" weight="bold">{activity.data?.count ?? 0}</Text><Text as="div" mt="2" size="1" color="gray">مشاهده تاریخچه</Text></Link></Card>;
}

export default DashboardComponent;
