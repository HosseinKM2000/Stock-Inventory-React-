import { InvoicesPage } from "@/features/invoices/invoices-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/invoices")({ component: InvoicesPage });
