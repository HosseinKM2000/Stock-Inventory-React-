import { SettingNavigation } from "@/features/setting/components/layout";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/setting")({
  component: SettingLayout,
});

function SettingLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r">
        <SettingNavigation/>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
