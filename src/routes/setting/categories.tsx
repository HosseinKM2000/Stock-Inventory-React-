import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/categories")({
  beforeLoad: () => { throw redirect({ to: "/tools/categories", replace: true }); },
});
