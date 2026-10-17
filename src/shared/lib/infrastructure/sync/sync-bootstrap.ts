import { dashboardKeys } from "@/features/app/dashboard/query/dashboard-query-keys";
import { productKeys } from "@/features/app/inventory/query/query-keys";
import {
  recoverMissingProductConflicts,
  registerProductSync,
} from "@/features/app/inventory/services/product-sync";
import { registerCategorySync } from "@/features/setting/services/category-sync";
import { registerLabelSync } from "@/features/setting/services/label-sync";
import { registerBarcodeSync } from "@/features/barcode/services/barcode-sync";
import { registerMovementSync } from "@/features/barcode/services/movement-sync";
import { labelKeys } from "@/features/setting/mutations/use-labels";
import { categoryKeys } from "@/features/setting/query/query-keys";
import { exportKeys } from "@/features/setting/query/query-keys";
import { queryClient } from "@/shared/api/query-client";

import { startSyncListeners } from "./sync-listener";
import { onSyncSettled } from "./sync-service";

let started = false;
let recovery = Promise.resolve();

function invalidateProductViews() {
  queryClient.invalidateQueries({ queryKey: productKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  queryClient.invalidateQueries({ queryKey: exportKeys.all });
}

/** Single entry point that wires entities, triggers and cache invalidation. */
export function startSync() {
  if (started) return recovery;

  started = true;

  registerProductSync();
  registerCategorySync();
  registerLabelSync();
  registerBarcodeSync();
  registerMovementSync();

  recovery = recoverMissingProductConflicts()
    .then((restored) => {
      if (restored > 0) invalidateProductViews();
    })
    .catch(() => {
      // Startup must remain available if IndexedDB recovery is unavailable.
    });

  onSyncSettled(() => {
    invalidateProductViews();
    queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    queryClient.invalidateQueries({ queryKey: labelKeys.all });
  });

  startSyncListeners();
  return recovery;
}
