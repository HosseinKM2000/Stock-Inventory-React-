import { DashboardActions } from "@/features/app/dashboard/components/dashboard-actions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/actions/")({
  component: DashboardActions,
});
