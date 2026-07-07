"use client";

import Header from "@/features/app/layout/header";
import NavMenu from "@/features/app/layout/nav-menu";

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
    <>
      {!hideLayout && <Header />}
      {!hideLayout && <NavMenu />}

      <main className="flex-1 p-10">
        <Outlet />
      </main>
    </>
  );
}
