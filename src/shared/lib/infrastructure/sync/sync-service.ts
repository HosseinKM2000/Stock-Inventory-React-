import {
  updateProduct,
  deleteProduct,
} from "@/features/app/inventory/api/products.api";

import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";

import { queueService } from "./queue.service";

import type { ProductInput } from "@/features/app/inventory/types";

export const syncService = {
  async sync() {
    const queue = await queueService.getAll();

    for (const item of queue) {
      try {
        switch (item.action) {
          case "UPSERT": {
            const result = await updateProduct(
              item.entityId,
              item.payload as ProductInput,
            );

            await inventoryRepository.save(result);

            break;
          }

          case "DELETE": {
            await deleteProduct(item.entityId);

            await inventoryRepository.remove(item.entityId);

            break;
          }
        }

        await queueService.remove(item.id);
      } catch (error) {
        console.error("sync failed", error);

        // اولین خطا را نگه می داریم
        // بقیه بعداً تلاش می‌شوند

        break;
      }
    }
  },
};
