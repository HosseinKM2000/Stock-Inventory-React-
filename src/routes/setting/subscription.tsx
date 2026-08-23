import SubscriptionSettings from "@/features/setting/components/subscription";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/subscription")({ component: SubscriptionPage });
function SubscriptionPage() { return <OnlineGuard><SubscriptionSettings /></OnlineGuard>; }
