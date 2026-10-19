import Industries from "@/features/setting/components/industry";
import { createFileRoute } from "@tanstack/react-router";
import { OnlineGuard } from "@/shared/access/online-guard";
import { CapabilityGuard } from "@/shared/access/capability-guard";

export const Route = createFileRoute("/setting/industry")({
  component: RouteComponent,
});

function RouteComponent() {
  return <OnlineGuard><CapabilityGuard capability="industry.manage" admin><Industries /></CapabilityGuard></OnlineGuard>;
}
