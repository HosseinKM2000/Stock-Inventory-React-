import { Callout, Skeleton } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarCheck, LayoutDashboard } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { personnelApi } from "@/features/personnel/api";
import { accessState } from "@/shared/access/access-state";
import { isAdmin } from "@/shared/access/authorization";
import { consumeDashboardReturnAnchor, rememberDashboardReturnAnchor } from "@/shared/lib/navigation/scroll-restoration";

import { dashboardCards } from "../data/dashboard-cards";
import { useDashboardStats } from "../mutations/use-dashboard";
import type { DashboardStats } from "../types";
import "./dashboard.css";

type DashboardCard = (typeof dashboardCards)[number];
type CardVariant = "alert" | "feature" | "metric" | "row";

const sections = {
  alerts: new Set(["urgent-purchase", "no-price"]),
  priority: new Set(["actions"]),
  overview: new Set(["all", "out-of-stock", "low-stock"]),
  analysis: new Set(["invoice-reports", "financial", "highest-value", "inventory-value"]),
  completion: new Set(["unclassified", "no-image", "today", "hidden"]),
};

const emptyStats: DashboardStats = {
  totalProducts: 0, inventoryValue: 0, lowStockCount: 0, outOfStockCount: 0, hiddenCount: 0,
  noImageCount: 0, noPriceCount: 0, urgentPurchaseCount: 0, addedTodayCount: 0,
  missingClassificationCount: 0, valuedProductsCount: 0, todayActionCount: 0,
};

const DashboardComponent = () => {
  const navigate = useNavigate();
  const user = accessState.user();
  const userId = user?.id;
  const storeId = user?.store_id;
  const isOwner = user?.is_store_owner === true || isAdmin(user);
  const { data: stats, isLoading, isError } = useDashboardStats();

  useEffect(() => {
    const anchorId = consumeDashboardReturnAnchor(userId, storeId);
    if (anchorId) document.getElementById(anchorId)?.scrollIntoView({ block: "center" });
  }, [storeId, userId]);

  const openCard = (card: DashboardCard) => {
    rememberDashboardReturnAnchor(userId, `dashboard-section-${card.id}`, storeId);
    void navigate({ to: card.to });
  };

  const visibleCards = dashboardCards.filter((card) =>
    (!card.permission || accessState.hasStorePermission(card.permission)) &&
    (!card.capabilities || card.capabilities.some((capability) => accessState.canUse(capability))),
  );
  const cardsFor = (ids: Set<string>) => visibleCards.filter((card) => ids.has(card.id));
  const alertCards = cardsFor(sections.alerts);
  const priorityCard = cardsFor(sections.priority)[0];
  const overviewCards = cardsFor(sections.overview);
  const analysisCards = cardsFor(sections.analysis);
  const completionCards = cardsFor(sections.completion);

  return (
    <main className="dashboard-page app-responsive-page">
      <header className="dashboard-hero">
        <span className="dashboard-hero__icon" aria-hidden="true"><LayoutDashboard /></span>
        <div><h1>داشبورد</h1><p>تصویر روشن و به‌روز از وضعیت موجودی و کارهای مهم مجموعه</p></div>
      </header>

      {isError ? <Callout.Root color="red" dir="rtl" role="alert"><Callout.Text>دریافت اطلاعات داشبورد انجام نشد. اتصال را بررسی و دوباره تلاش کنید.</Callout.Text></Callout.Root> : null}

      {alertCards.length ? <section className="dashboard-alerts" aria-label="هشدارهای فوری">
        {alertCards.map((card) => <DashboardSummaryCard key={card.id} card={card} stats={stats} loading={isLoading} variant="alert" onOpen={openCard} />)}
      </section> : null}

      {priorityCard ? <DashboardSection title="اقدام‌های اولویت‌دار" className="dashboard-section--priority" action={
        <a href={priorityCard.to} onClick={(event) => { event.preventDefault(); openCard(priorityCard); }}>مشاهده همه <ArrowLeft aria-hidden="true" /></a>
      }><DashboardSummaryCard card={priorityCard} stats={stats} loading={isLoading} variant="feature" onOpen={openCard} /></DashboardSection> : null}

      {overviewCards.length ? <DashboardSection title="نمای کلی" className="dashboard-section--overview"><div className="dashboard-metrics">
        {overviewCards.map((card) => <DashboardSummaryCard key={card.id} card={card} stats={stats} loading={isLoading} variant="metric" onOpen={openCard} />)}
      </div></DashboardSection> : null}

      <div className="dashboard-detail-grid">
        {analysisCards.length ? <DashboardSection title="تحلیل موجودی و فاکتورها"><div className="dashboard-rows">
          {analysisCards.map((card) => <DashboardSummaryCard key={card.id} card={card} stats={stats} loading={isLoading} variant="row" onOpen={openCard} />)}
        </div></DashboardSection> : null}

        {completionCards.length || isOwner ? <DashboardSection title="تکمیل اطلاعات"><div className="dashboard-rows">
          {completionCards.map((card) => <DashboardSummaryCard key={card.id} card={card} stats={stats} loading={isLoading} variant="row" onOpen={openCard} />)}
          {isOwner ? <TodayActivityCard /> : null}
        </div></DashboardSection> : null}
      </div>
    </main>
  );
};

function DashboardSection({ title, action, className = "", children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`dashboard-section ${className}`} aria-label={title}>
    <div className="dashboard-section__heading"><h2>{title}</h2>{action}</div>{children}
  </section>;
}

function DashboardSummaryCard({ card, stats, loading, variant, onOpen }: { card: DashboardCard; stats: DashboardStats | undefined; loading: boolean; variant: CardVariant; onOpen(card: DashboardCard): void }) {
  const Icon = card.icon;
  const urgent = card.id === "out-of-stock" || card.id === "urgent-purchase";
  return <button id={`dashboard-section-${card.id}`} type="button" data-tone={card.color} data-priority={urgent ? "urgent" : "normal"} className={`dashboard-card dashboard-card--${variant}`} onClick={() => onOpen(card)}>
    <span className="dashboard-card__icon" aria-hidden="true"><Icon /></span>
    <span className="dashboard-card__copy"><span className="dashboard-card__label">{card.label}</span><Skeleton loading={loading}><strong className="dashboard-card__value">{card.value(stats ?? emptyStats)}</strong></Skeleton></span>
    {card.badge && variant === "alert" ? <span className="dashboard-card__badge">{card.badge.text}</span> : null}
    {variant === "row" || variant === "alert" ? <ArrowLeft className="dashboard-card__arrow" aria-hidden="true" /> : null}
  </button>;
}

function TodayActivityCard() {
  const activity = useQuery({ queryKey: ["store-activity-today"], queryFn: personnelApi.todayActivity });
  return <Link to="/tools/activity" className="dashboard-card dashboard-card--row" data-tone="purple">
    <span className="dashboard-card__icon" aria-hidden="true"><CalendarCheck /></span>
    <span className="dashboard-card__copy"><span className="dashboard-card__label">فعالیت امروز مجموعه</span><strong className="dashboard-card__value">{(activity.data?.count ?? 0).toLocaleString("fa-IR")} رویداد</strong></span>
    <ArrowLeft className="dashboard-card__arrow" aria-hidden="true" />
  </Link>;
}

export default DashboardComponent;
