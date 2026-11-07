import { Outlet } from "@tanstack/react-router";

import Header from "./header";
import NavMenu from "./nav-menu";

export function SectionLayout() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <Header />
      <main className="app-responsive-page app-shell-content min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
      <NavMenu />
    </div>
  );
}
