import Header from "@/features/app/layout/header";
import NavMenu from "@/features/app/layout/nav-menu";

import { isAuthenticated } from "@/shared/api/token-store";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/industry")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({
        to: "/auth/login",
      });
    }
  },

  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <>
      <Header />
      <NavMenu />
      <main className="app-responsive-page min-w-0 flex-1 overflow-x-hidden p-4 md:p-10">
        <Outlet />
      </main>
    </>
  );
}
