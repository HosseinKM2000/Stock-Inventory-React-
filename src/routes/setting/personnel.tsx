import { createFileRoute, redirect } from "@tanstack/react-router";
import { PersonnelPage } from "@/features/personnel/personnel-page";
import { accessState } from "@/shared/access/access-state";
import { isAdmin } from "@/shared/access/authorization";

export const Route = createFileRoute("/setting/personnel")({ beforeLoad: () => { const user = accessState.user(); if (!isAdmin(user) && !user?.is_store_owner) throw redirect({ to: "/setting" }); }, component: PersonnelPage });
