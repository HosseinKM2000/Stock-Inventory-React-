import SubscriptionSettings from "@/features/setting/components/subscription";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/subscription")({ component: SubscriptionPage });
function SubscriptionPage() { return <SubscriptionSettings />; }
