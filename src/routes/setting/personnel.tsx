import { createFileRoute, redirect } from "@tanstack/react-router";
import { PersonnelPage } from "@/features/personnel/personnel-page";
import { accessState } from "@/shared/access/access-state";

export const Route = createFileRoute("/setting/personnel")({ beforeLoad: () => { if (!accessState.user()?.is_store_owner) throw redirect({ to: "/setting" }); }, component: PersonnelPage });
