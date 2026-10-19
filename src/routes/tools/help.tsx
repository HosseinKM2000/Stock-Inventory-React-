import { HelpPage } from "@/features/help/help-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/help")({ component: HelpPage });
