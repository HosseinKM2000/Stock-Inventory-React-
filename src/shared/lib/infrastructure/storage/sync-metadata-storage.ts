import { db } from "./db";

export const syncMetadataStorage = {
  async getNumber(key: string, fallback = 0) {
    const item = await db.syncMetadata.get(key);

    return typeof item?.value === "number" ? item.value : fallback;
  },

  async set(key: string, value: number | string | null) {
    await db.syncMetadata.put({ key, value, updatedAt: Date.now() });
  },
};
