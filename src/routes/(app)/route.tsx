import Header from "@/features/app/layout/header";
import NavMenu from "@/features/app/layout/nav-menu";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
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
