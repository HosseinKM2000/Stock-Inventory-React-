import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/shared/auth/auth-provider";
import { AccessBoundary } from "@/shared/access/access-boundary";
import { AuthenticatedPwaInstallPromotion } from "@/shared/lib/infrastructure/pwa/pwa-install-button";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <AccessBoundary><Outlet /></AccessBoundary>
      <AuthenticatedPwaInstallPromotion />
    </AuthProvider>
  ),
});
