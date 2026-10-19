import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/catalogs")({
  beforeLoad: () => { throw redirect({ to: "/management/catalogs", replace: true }); },
});
