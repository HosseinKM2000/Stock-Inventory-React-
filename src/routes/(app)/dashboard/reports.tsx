import { InvoiceDashboardReports } from "@/features/app/dashboard/components/invoice-dashboard-reports";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard/reports")({ component: InvoiceDashboardReports });
