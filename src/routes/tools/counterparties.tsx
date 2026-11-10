import { CounterpartiesPage } from "@/features/counterparties/counterparties-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/counterparties")({ component: CounterpartiesPage });
