import { DashboardHighestValue } from "@/features/app/dashboard/components/dashboard-highest-value";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/highest-value/")({
  component: DashboardHighestValue,
});
