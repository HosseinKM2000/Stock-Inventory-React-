const PERSISTENCE_ATTEMPT_KEY = "tanzim-storage-persistence-attempted-v1";

export type StoragePersistenceState = {
  supported: boolean;
  persisted: boolean | null;
  requested: boolean;
};

function storageManager(): StorageManager | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage;
}

function wasAttempted(): boolean {
  try {
    return localStorage.getItem(PERSISTENCE_ATTEMPT_KEY) === "1";
  } catch {
    return false;
  }
}

function recordAttempt(): void {
  try {
    localStorage.setItem(PERSISTENCE_ATTEMPT_KEY, "1");
  } catch {
    // Private browsing may not expose localStorage. The request is still safe.
  }
}

/**
 * Requests durable origin storage once. This protects Cache Storage, IndexedDB
 * and OPFS from ordinary eviction when the browser grants it; it cannot
 * protect data a user explicitly clears.
 */
export const storagePersistenceService = {
  async ensure(): Promise<StoragePersistenceState> {
    const storage = storageManager();
    if (!storage?.persisted) {
      return { supported: false, persisted: null, requested: false };
    }

    try {
      if (await storage.persisted()) {
        return { supported: true, persisted: true, requested: false };
      }
    } catch {
      return { supported: true, persisted: null, requested: false };
    }

    if (!storage.persist || wasAttempted()) {
      return { supported: true, persisted: false, requested: false };
    }

    recordAttempt();
    try {
      return { supported: true, persisted: await storage.persist(), requested: true };
    } catch {
      return { supported: true, persisted: false, requested: true };
    }
  },

  async status(): Promise<StoragePersistenceState> {
    const storage = storageManager();
    if (!storage?.persisted) {
      return { supported: false, persisted: null, requested: false };
    }

    try {
      return { supported: true, persisted: await storage.persisted(), requested: false };
    } catch {
      return { supported: true, persisted: null, requested: false };
    }
  },
};
