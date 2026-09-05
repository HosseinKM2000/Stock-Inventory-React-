import { lazy, Suspense } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/shared/auth/auth-provider";
import { AccessBoundary } from "@/shared/access/access-boundary";

const RouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("@tanstack/router-devtools");

      return { default: module.TanStackRouterDevtools };
    })
  : null;

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <AccessBoundary><Outlet /></AccessBoundary>
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </AuthProvider>
  ),
});
