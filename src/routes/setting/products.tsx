import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/products")({
  beforeLoad: () => { throw redirect({ to: "/tools/recovery", replace: true }); },
});
