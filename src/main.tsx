import { queryClient } from "@/shared/api/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";

import "@/style/index.css";
import "@radix-ui/themes/styles.css";
import { startSync } from "@/shared/lib/infrastructure/sync/sync-bootstrap";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { registerServiceWorker } from "@/shared/lib/infrastructure/pwa/register-service-worker";
import { AppTheme } from "@/shared/theme/app-theme";
import { profileMediaRepository } from "@/shared/profile-media/profile-media.repository";
import { toast } from "sonner";

const router = createRouter({ routeTree });

registerServiceWorker({
  onOfflineReady() {
    if (sessionStorage.getItem("tanzim-offline-ready-notified") === "1") return;
    sessionStorage.setItem("tanzim-offline-ready-notified", "1");
    toast.success("برنامه برای استفاده آفلاین آماده است");
  },
  onUpdateReady(activate) {
    toast("نسخه جدید برنامه آماده است", {
      id: "tanzim-update-ready",
      duration: Infinity,
      action: {
        label: "به‌روزرسانی",
        onClick() {
          if (queryClient.isMutating() > 0) {
            toast.warning("پس از پایان ذخیره‌سازی دوباره تلاش کنید");
            return;
          }
          activate();
        },
      },
    });
  },
});

profileMediaRepository.cleanupLegacyPreference();

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
      <AppTheme>
        <RouterProvider router={router} />
      </AppTheme>
    </QueryClientProvider>
  </React.StrictMode>,
);
