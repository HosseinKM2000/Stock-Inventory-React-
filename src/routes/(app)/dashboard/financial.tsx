import { FinancialDashboard } from "@/features/app/dashboard/components/financial-dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/financial")({ component: FinancialDashboard });
