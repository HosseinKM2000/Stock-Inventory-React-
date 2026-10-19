import { DashboardClassification } from "@/features/app/dashboard/components/dashboard-classification";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/products/unclassified/")({
  component: DashboardClassification,
});
