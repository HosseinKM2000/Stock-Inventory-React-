import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/subscription-management")({
  beforeLoad: () => { throw redirect({ to: "/management/subscriptions", replace: true }); },
});
