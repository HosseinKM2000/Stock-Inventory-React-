import { db } from "@/shared/lib/infrastructure/storage/db";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { accessState } from "@/shared/access/access-state";

const ownerId = () => accessState.user()?.id;
const storeId = () => { const user = accessState.user(); return user ? user.store_id ?? user.id : undefined; };

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
      storeId: storeId() ?? undefined,
    });
  },

  async get(id: string) {
    const owner = ownerId();
    if (!owner) return undefined;
    const current = await db.syncQueue.get(scopedId(id));
    if (current?.ownerUserId === owner && current.storeId === storeId()) return current;
    const legacy = await db.syncQueue.get(id);
    return legacy?.ownerUserId === owner && (legacy.storeId == null || legacy.storeId === storeId()) ? legacy : undefined;
  },

  async getAll() {
    const owner = ownerId();
    if (!owner) return [];
    return (await db.syncQueue.where("ownerUserId").equals(owner).toArray()).filter((item) => item.storeId == null || item.storeId === storeId()).sort((a, b) => a.createdAt - b.createdAt);
  },

  async getForEntity(entity: string, entityId: number) {
    return (await this.getAll()).filter(
      (item) => item.entity === entity && item.entityId === entityId,
    );
  },

  async count() {
    const owner = ownerId();
    if (!owner) return 0;
    return db.syncQueue.where("ownerUserId").equals(owner).count();
  },

  async claim(id: string, expectedUpdatedAt: number, leaseUntil: number) {
    const owner = ownerId();
    if (!owner) return undefined;

    return db.transaction("rw", db.syncQueue, async () => {
      const item = await this.get(id);
      if (
        !item ||
        item.ownerUserId !== owner ||
        item.updatedAt !== expectedUpdatedAt ||
        !(
          item.status === "pending" ||
          item.status === "retryable_error" ||
          (item.status === "in_flight" && item.nextAttemptAt <= Date.now())
        )
      ) {
        return undefined;
      }

      const claimed = {
        ...item,
        status: "in_flight" as const,
        nextAttemptAt: leaseUntil,
      };
      await db.syncQueue.put(claimed);
      return claimed;
    });
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
