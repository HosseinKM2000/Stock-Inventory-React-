import { SectionLayout } from "@/features/app/layout/section-layout";
import { isAuthenticated } from "@/shared/api/token-store";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { accessState } from "@/shared/access/access-state";
import type { DomainToolId } from "@/shared/access/tools";

const protectedTools: Record<string, DomainToolId> = {
  import: "import", labels: "labels", categories: "categories", export: "export", catalog: "catalog", recovery: "recovery",
};
const toolPermissions: Record<string, string> = { import: "tools.import", labels: "labels.manage", categories: "categories.manage", export: "tools.export", catalog: "tools.catalog" };

export const Route = createFileRoute("/tools")({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
    const tool = protectedTools[location.pathname.split("/").filter(Boolean).at(-1) ?? ""];
    // The cached entitlement is the authoritative offline snapshot. Checking
    // the effective policy here prevents a copied URL from bypassing either
    // the domain policy or the subscription capability gate.
    if (tool && accessState.user() && !accessState.canUseTool(tool)) throw redirect({ to: "/tools" });
    const permission = toolPermissions[location.pathname.split("/").filter(Boolean).at(-1) ?? ""];
    if (permission && !accessState.hasStorePermission(permission)) throw redirect({ to: "/tools" });
  },
  component: SectionLayout,
});
