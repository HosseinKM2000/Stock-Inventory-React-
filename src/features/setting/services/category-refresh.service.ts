import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { getCategories } from "../api/categories.api";
import { CATEGORY_ENTITY } from "./category.service";

export const categoryRefreshService = {
  async refreshFromServer() {
    if (networkService.isOffline()) {
      throw new Error("برای دریافت دسته‌بندی‌ها از سرور، اتصال اینترنت لازم است.");
    }

    await syncService.sync();
    const pendingCategories = (await queueService.getAll()).filter(
      (item) => item.entity === CATEGORY_ENTITY,
    );
    if (pendingCategories.length > 0) {
      throw new Error(
        "ابتدا تغییرات دسته‌بندی در انتظار همگام‌سازی را برطرف کنید و دوباره تلاش کنید.",
      );
    }

    const serverCategories = await getCategories();
    await categoryStorage.replaceAll(serverCategories);
  },
};
