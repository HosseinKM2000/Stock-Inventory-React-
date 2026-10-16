import { SectionLayout } from "@/features/app/layout/section-layout";
import { isAuthenticated } from "@/shared/api/token-store";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { accessState } from "@/shared/access/access-state";
import { isAdmin } from "@/shared/access/authorization";

export const Route = createFileRoute("/setting")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
    const ownerOnly = ["/setting/personnel", "/setting/backup", "/setting/subscription"];
    const user = accessState.user();
    if (ownerOnly.includes(location.pathname) && !isAdmin(user) && user?.is_store_owner === false) throw redirect({ to: "/setting" });
  },
  component: SectionLayout,
});
