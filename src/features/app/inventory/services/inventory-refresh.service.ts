import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { pullProductChanges } from "../api/sync.api";
import { inventoryRepository } from "./inventory.repository";
import { inventoryService } from "./inventory-service";

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

    const response = await pullProductChanges(0);
    const localById = new Map(
      (await inventoryRepository.getAll()).map((product) => [product.id, product]),
    );
    const snapshot = response.changes.flatMap((change) => {
      if (change.operation !== "UPSERT" || !change.record) return [];
      const local = localById.get(change.entity_id);
      const localImage = local?.image_url?.startsWith("local://")
        ? local.image_url
        : null;
      return [{
        ...change.record,
        image_url: localImage ?? change.record.image_url ?? null,
        server_image_url: change.record.image_url ?? null,
      }];
    });

    await inventoryRepository.replaceAll(snapshot);
    await syncMetadataStorage.set(CURSOR_KEY, response.cursor);
    await syncMetadataStorage.set(INITIALIZED_KEY, 1);
    await inventoryService.cleanupImages();
  },
};
