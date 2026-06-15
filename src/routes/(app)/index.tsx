import DashboardComponents from "@/features/app/dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/")({
  component: DashboardComponents,
});

