"use client";

import Header from "@/features/app/layout/header";
import NavMenu from "@/features/app/layout/nav-menu";
import ConnectionStatus from "@/features/app/layout/connection-status";

import { isAuthenticated } from "@/shared/api/token-store";
import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
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
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
 
  const hideLayout = pathname === "/industry";

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      {!hideLayout && <Header />}
      {!hideLayout && <NavMenu />}
      {hideLayout && (
        <div className="fixed left-3 top-3 z-50">
          <ConnectionStatus />
        </div>
      )}

      <main className="app-shell-content min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
