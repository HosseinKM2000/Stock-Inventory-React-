import Header from "@/features/app/layout/header";
import NavMenu from "@/features/app/layout/nav-menu";
import { isAuthenticated } from "@/shared/api/token-store";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/auth/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <>
      <Header />
      <NavMenu />
      <main className="flex-1 p-10">
        <Outlet />
      </main>
    </>
  );
}
