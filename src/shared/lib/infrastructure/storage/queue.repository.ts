import { db } from "./db";

import type { SyncQueueItem } from "./types";

export const queueRepository = {

  getAll() {
    return db.syncQueue.toArray();
  },

  save(item: SyncQueueItem) {
    return db.syncQueue.put(item);
  },

  delete(id: string) {
    return db.syncQueue.delete(id);
  },

  clear() {
    return db.syncQueue.clear();
  },
};