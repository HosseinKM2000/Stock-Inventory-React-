import { db } from "@/shared/lib/infrastructure/storage/db";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

export const queueStorage = {
  async upsert(item: SyncQueueItem) {
    return db.syncQueue.put(item);
  },

  async get(id: string) {
    return db.syncQueue.get(id);
  },

  async getAll() {
    return db.syncQueue.orderBy("createdAt").toArray();
  },

  async count() {
    return db.syncQueue.count();
  },

  async remove(id: string) {
    return db.syncQueue.delete(id);
  },

  async clear() {
    return db.syncQueue.clear();
  },
};
