import { db } from "@/shared/lib/infrastructure/storage/db";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { accessState } from "@/shared/access/access-state";

const ownerId = () => accessState.user()?.id;

function scopedId(id: string) {
  const owner = ownerId();
  if (!owner || id.startsWith(`${owner}:`)) return id;
  return `${owner}:${id}`;
}

export const queueStorage = {
  async upsert(item: SyncQueueItem) {
    const owner = ownerId();
    if (!owner) throw new Error("برای همگام‌سازی باید وارد حساب شوید");
    return db.syncQueue.put({
      ...item,
      id: scopedId(item.id),
      ownerUserId: owner,
    });
  },

  async get(id: string) {
    const owner = ownerId();
    if (!owner) return undefined;
    const current = await db.syncQueue.get(scopedId(id));
    if (current?.ownerUserId === owner) return current;
    const legacy = await db.syncQueue.get(id);
    return legacy?.ownerUserId === owner ? legacy : undefined;
  },

  async getAll() {
    const owner = ownerId();
    if (!owner) return [];
    return db.syncQueue.where("ownerUserId").equals(owner).sortBy("createdAt");
  },

  async count() {
    const owner = ownerId();
    if (!owner) return 0;
    return db.syncQueue.where("ownerUserId").equals(owner).count();
  },

  async remove(id: string) {
    const item = await this.get(id);
    if (item) return db.syncQueue.delete(item.id);
  },

  async clear() {
    const items = await this.getAll();
    return db.syncQueue.bulkDelete(items.map((item) => item.id));
  },
};
