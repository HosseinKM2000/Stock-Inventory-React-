import { createFileRoute, redirect } from "@tanstack/react-router";
import { ActivityPage } from "@/features/personnel/activity-page";
import { accessState } from "@/shared/access/access-state";
import { isAdmin } from "@/shared/access/authorization";

export const Route = createFileRoute("/tools/activity")({ beforeLoad: () => { const user = accessState.user(); if (!isAdmin(user) && !user?.is_store_owner) throw redirect({ to: "/tools" }); }, component: ActivityPage });
