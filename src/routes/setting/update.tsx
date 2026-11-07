import { AppUpdatePage } from "@/features/app-update/components/app-update-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/update")({ component: AppUpdatePage });
