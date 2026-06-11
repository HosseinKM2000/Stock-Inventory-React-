import { SettingNavigation } from "@/features/setting/components/layout";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/setting")({
  component: SettingLayout,
});

function SettingLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="border-r">
        <SettingNavigation/>
      </aside>
      <main className="flex-1 p-10">
        <Outlet />
      </main>
    </div>
  );
}
