import { db } from "./db";
import { accessState } from "@/shared/access/access-state";

function scopedKey(key: string) {
  const owner = accessState.user()?.id;
  return owner ? `${owner}:${key}` : `anonymous:${key}`;
}

export const syncMetadataStorage = {
  async getNumber(key: string, fallback = 0) {
    const item = await db.syncMetadata.get(scopedKey(key));

    return typeof item?.value === "number" ? item.value : fallback;
  },

  async set(key: string, value: number | string | null) {
    const storageKey = scopedKey(key);
    await db.syncMetadata.put({ key: storageKey, value, updatedAt: Date.now() });
  },
};
