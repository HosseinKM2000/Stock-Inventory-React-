import { queryClient } from "@/shared/api/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";

import "@radix-ui/themes/styles.css";
import "@/style/index.css";
import { startSync } from "@/shared/lib/infrastructure/sync/sync-bootstrap";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { registerServiceWorker } from "@/shared/lib/infrastructure/pwa/register-service-worker";
import { AppTheme } from "@/shared/theme/app-theme";
import { profileMediaRepository } from "@/shared/profile-media/profile-media.repository";
import { toast } from "sonner";
import { accessState } from "@/shared/access/access-state";
import { accountScrollRestorationKey } from "@/shared/lib/navigation/scroll-restoration";
import { startBackupAutomation } from "@/features/backup/services/backup-bootstrap";
import { appUpdateService } from "@/features/app-update/services/app-update.service";
import { db } from "@/shared/lib/infrastructure/storage/db";

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  scrollToTopSelectors: ["[data-scroll-restoration-id='app-shell']"],
  getScrollRestorationKey: (location) =>
    accountScrollRestorationKey(
      location,
      accessState.user()?.id,
      accessState.user()?.store_id,
    ),
});

appUpdateService.initialize();
registerServiceWorker({
  onRegistered(registration) {
    appUpdateService.connectRegistration(registration);
  },
  onOfflineReady() {
    if (sessionStorage.getItem("tanzim-offline-ready-notified") === "1") return;
    sessionStorage.setItem("tanzim-offline-ready-notified", "1");
    toast.success("برنامه برای استفاده آفلاین آماده است");
  },
  onUpdateReady(activate) {
    appUpdateService.notifyUpdateReady(activate);
    toast("نسخه جدید برنامه آماده است", {
      id: "tanzim-update-ready",
      duration: Infinity,
      action: {
        label: "به‌روزرسانی",
        onClick() {
          void appUpdateService.activateUpdate();
        },
      },
    });
  },
  onUpdateActivated(buildId, activatedHere) {
    appUpdateService.notifyUpdateActivated(buildId, activatedHere);
  },
  onUpdateFailed() {
    appUpdateService.notifyUpdateFailed();
  },
});

db.on("blocked", () => appUpdateService.notifyClientMigrationFailed(true));
void db.open().catch(() => appUpdateService.notifyClientMigrationFailed(false));

profileMediaRepository.cleanupLegacyPreference();
startBackupAutomation();

// Recover product records retained in conflict payloads before orphan cleanup
// inspects their image references.
void startSync().finally(() => {
  // Clean files left by an abandoned/failed image form on the next app start.
  void inventoryService.cleanupImages().catch(() => {
    // OPFS is not available in every browser; image operations surface their
    // own errors when the user attempts them.
  });
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
