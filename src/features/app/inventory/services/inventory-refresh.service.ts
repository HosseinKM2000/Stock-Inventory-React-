import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { syncStatusStore } from "@/shared/lib/infrastructure/sync/sync-status";

const CURSOR_KEY = "product-sync-cursor";
const INITIALIZED_KEY = "product-sync-initialized";

export const inventoryRefreshService = {
  async refreshFromServer() {
    if (networkService.isOffline()) {
      throw new Error("برای دریافت آخرین اطلاعات از سرور، اتصال اینترنت لازم است.");
    }

    // Push/reconcile the normal queue first. A full inbound snapshot must never
    // overwrite records that still have unsynchronized local mutations.
    await syncService.sync();

    if ((await queueService.count()) > 0) {
      throw new Error(
        "ابتدا تغییرات محلی در انتظار همگام‌سازی را برطرف کنید؛ سپس دوباره تلاش کنید.",
      );
    }

    await syncMetadataStorage.set(CURSOR_KEY, 0);
    await syncMetadataStorage.set(INITIALIZED_KEY, 0);
    await syncService.sync();

    const status = syncStatusStore.get();
    if (
      status.state === "failed" &&
      status.error &&
      status.error !== "SUBSCRIPTION_EXPIRED"
    ) {
      throw new Error("دریافت محصولات از سرور ناموفق بود. دوباره تلاش کنید.");
    }
  },
};
