import DashboardProducts from "@/features/app/dashboard/components/dashboard-products";
import { DashboardFilters } from "@/features/app/dashboard/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/out-of-stock/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <DashboardProducts filter={DashboardFilters.OUT_OF_STOCK} />;
}
