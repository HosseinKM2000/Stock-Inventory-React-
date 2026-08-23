export type StorageQuotaInfo = {
  used: number;
  quota: number;
  available: number;
  percentage: number;
};

export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Browser storage does not have enough free space for this image");
  }
}

export const storageQuotaService = {
  async estimate(): Promise<StorageQuotaInfo | null> {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return null;
    }

    const estimate = await navigator.storage.estimate();
    const used = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;

    if (quota <= 0) return null;

    return {
      used,
      quota,
      available: Math.max(0, quota - used),
      percentage: Math.min(100, (used / quota) * 100),
    };
  },

  async ensureAvailable(bytes: number) {
    const estimate = await this.estimate();

    if (estimate && estimate.available < bytes) {
      throw new StorageQuotaExceededError();
    }
  },
};
