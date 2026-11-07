import { SectionLayout } from "@/features/app/layout/section-layout";
import { isAdmin } from "@/shared/access/authorization";
import { accessState } from "@/shared/access/access-state";
import { isAuthenticated } from "@/shared/api/token-store";
import { CapabilityGuard } from "@/shared/access/capability-guard";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/management")({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
    if (!isAdmin(accessState.user())) throw redirect({ to: "/dashboard" });
  },
  component: ManagementLayout,
});

function ManagementLayout() {
  return <CapabilityGuard admin><SectionLayout /></CapabilityGuard>;
}
