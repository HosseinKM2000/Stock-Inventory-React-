import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/users")({
  beforeLoad: () => { throw redirect({ to: "/management/users", replace: true }); },
});
