import DashboardProducts from "@/features/app/dashboard/components/dashboard-products";
import { DashboardFilters } from "@/features/app/dashboard/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/urgent-purchase/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardProducts filter={DashboardFilters.URGENT_PURCHASE} />;
}
