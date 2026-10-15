import { createFileRoute, redirect } from "@tanstack/react-router";
import { ActivityPage } from "@/features/personnel/activity-page";
import { accessState } from "@/shared/access/access-state";

export const Route = createFileRoute("/tools/activity")({ beforeLoad: () => { if (!accessState.user()?.is_store_owner) throw redirect({ to: "/tools" }); }, component: ActivityPage });
