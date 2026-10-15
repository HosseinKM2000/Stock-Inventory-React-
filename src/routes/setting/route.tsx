import { SectionLayout } from "@/features/app/layout/section-layout";
import { isAuthenticated } from "@/shared/api/token-store";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { accessState } from "@/shared/access/access-state";

export const Route = createFileRoute("/setting")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
    const ownerOnly = ["/setting/personnel", "/setting/backup", "/setting/subscription"];
    if (ownerOnly.includes(location.pathname) && accessState.user()?.is_store_owner === false) throw redirect({ to: "/setting" });
  },
  component: SectionLayout,
});
