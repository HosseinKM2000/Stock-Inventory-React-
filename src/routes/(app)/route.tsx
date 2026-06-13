import NavMenu from "@/features/app/layout/nav-menu";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="border-r">
        <NavMenu />
      </aside>
      <main className="flex-1 p-10 h-dvh">
        <Outlet />
      </main>
    </div>
  );
}
