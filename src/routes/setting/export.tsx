import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/export")({
  beforeLoad: () => { throw redirect({ to: "/tools/export", replace: true }); },
});
