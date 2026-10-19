import SubscriptionManagement from "@/features/setting/components/subscription-management";
import { CapabilityGuard } from "@/shared/access/capability-guard";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/subscription-management")({ component: Page });
function Page() { return <OnlineGuard><CapabilityGuard admin><SubscriptionManagement /></CapabilityGuard></OnlineGuard>; }
