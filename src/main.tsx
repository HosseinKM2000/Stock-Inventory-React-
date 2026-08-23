import { queryClient } from "@/shared/api/query-client";
import { Theme } from "@radix-ui/themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";

import "@/style/index.css";
import "@radix-ui/themes/styles.css";
import { startSync } from "@/shared/lib/infrastructure/sync/sync-bootstrap";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { registerServiceWorker } from "@/shared/lib/infrastructure/pwa/register-service-worker";

const router = createRouter({ routeTree });

registerServiceWorker();

startSync();

// Clean files left by an abandoned/failed image form on the next app start.
void inventoryService.cleanupImages().catch(() => {
  // OPFS is not available in every browser; image operations surface their own
  // errors when the user attempts them.
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="violet">
          <Toaster
            richColors
            closeButton
            theme="system"
            expand={false}
            duration={4000}
            position="top-center"
            toastOptions={{
              className: "font-sans",
            }}
          />
        <RouterProvider router={router} />
      </Theme>
    </QueryClientProvider>
  </React.StrictMode>,
);
