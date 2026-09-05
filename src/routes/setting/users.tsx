import { CapabilityGuard } from "@/shared/access/capability-guard";
import { OnlineGuard } from "@/shared/access/online-guard";
import UsersSettings from "@/features/setting/components/users";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/users")({ component: UsersPage });

function UsersPage() {
  return <OnlineGuard><CapabilityGuard admin><UsersSettings /></CapabilityGuard></OnlineGuard>;
}
