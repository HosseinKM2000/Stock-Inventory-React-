"use client";

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/dashboard")({
  // beforeLoad: () => {
  //   if (!isAuthenticated()) {
  //     throw redirect({
  //       to: "/auth/login",
  //     });
  //   }
  // },
  component: RouteComponent,
});

function RouteComponent() {
  // const pathname = useRouterState({
  //   select: (state) => state.location.pathname,
  // });

  // const hideLayout = pathname === "/industry";

  return (
    <>
      {/* {!hideLayout && <Header />}
      {!hideLayout && <NavMenu />} */}

      <main className="flex-1">
        <Outlet />
      </main>
    </>
  );
}
