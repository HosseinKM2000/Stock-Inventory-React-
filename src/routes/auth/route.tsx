import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { isAuthenticated } from "@/shared/api/token-store";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },

  component: ProtectedLayout,
});

function ProtectedLayout() {
  return <Outlet />;
}
