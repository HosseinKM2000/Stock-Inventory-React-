import Catalogs from "@/features/setting/components/catalogs";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";
import { CapabilityGuard } from "@/shared/access/capability-guard";

export const Route = createFileRoute("/setting/catalogs")({
  component: RouteComponent,
});

function RouteComponent() {
  return <OnlineGuard><CapabilityGuard capability="catalog.manage" admin><Catalogs /></CapabilityGuard></OnlineGuard>;
}
