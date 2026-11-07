import DashboardProducts from "@/features/app/dashboard/components/dashboard-products";
import { DashboardFilters } from "@/features/app/dashboard/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/inventory-value/")({
  component: () => <DashboardProducts filter={DashboardFilters.INVENTORY_VALUE} />,
});
