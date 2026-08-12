import { dashboardKeys } from "@/features/app/dashboard/query/dashboard-query-keys";
import { productKeys } from "@/features/app/inventory/query/query-keys";
import { registerProductSync } from "@/features/app/inventory/services/product-sync";
import { queryClient } from "@/shared/api/query-client";

import { startSyncListeners } from "./sync-listener";
import { onSyncSettled } from "./sync-service";

let started = false;

/** Single entry point that wires entities, triggers and cache invalidation. */
export function startSync() {
  if (started) return;

  started = true;

  registerProductSync();

  onSyncSettled(() => {
    queryClient.invalidateQueries({ queryKey: productKeys.all });

    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  });

  startSyncListeners();
}
