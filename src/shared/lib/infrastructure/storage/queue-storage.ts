import { db } from "@/shared/lib/infrastructure/storage/db";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

export const queueStorage = {
  async upsert(item: SyncQueueItem) {
    return db.syncQueue.put(item);
  },

  async getAll() {
    return db.syncQueue.toArray();
  },

  async remove(id: string) {
    return db.syncQueue.delete(id);
  },

  async clear() {
    return db.syncQueue.clear();
  },
};
