import { lazy, Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/shared/auth/auth-provider";

const RouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("@tanstack/router-devtools");

      return { default: module.TanStackRouterDevtools };
    })
  : null;

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </AuthProvider>
  ),
});
