import { db } from "./db";
import { accessState } from "@/shared/access/access-state";

export type LocalStorageFailureCode =
  | "quota_exceeded"
  | "storage_unavailable";

export class LocalStorageWriteError extends Error {
  readonly code: LocalStorageFailureCode;

  constructor(code: LocalStorageFailureCode, cause: unknown) {
    super(
      code === "quota_exceeded"
        ? "فضای ذخیره‌سازی مرورگر کافی نیست. هیچ تغییری ذخیره نشد."
        : "ذخیره محلی انجام نشد. دوباره تلاش کنید.",
      { cause },
    );
    this.name = "LocalStorageWriteError";
    this.code = code;
  }
}

function storageFailureCode(error: unknown): LocalStorageFailureCode | null {
  const name =
    error instanceof DOMException || error instanceof Error ? error.name : "";

  if (name === "QuotaExceededError") return "quota_exceeded";
  if (
    name === "AbortError" ||
    name === "InvalidStateError" ||
    name === "UnknownError"
  ) {
    return "storage_unavailable";
  }

  return null;
}

async function run<T>(
  tables: Parameters<typeof db.transaction>[1][],
  operation: () => Promise<T>,
): Promise<T> {
  const userId = accessState.user()?.id;
  const execute = async () => {
    if (userId) {
      const key = `tanzim:${userId}:restore-maintenance`;
      const raw = localStorage.getItem(key);
      if (raw) {
        let active = false;
        try {
          const lease = JSON.parse(raw) as { expiresAt?: number };
          active = typeof lease.expiresAt === "number" && lease.expiresAt > Date.now();
        } catch {
          // Invalid or legacy markers are stale and must not lock local writes forever.
        }
        if (active) throw new Error("BACKUP_RESTORE_MAINTENANCE");
        localStorage.removeItem(key);
      }
    }
    return db.transaction("rw", tables, operation);
  };
  try {
    if (userId && navigator.locks) {
      return await navigator.locks.request(`tanzim-local-mutations:${userId}`, execute);
    }
    return await execute();
  } catch (error) {
    const code = storageFailureCode(error);
    if (code) throw new LocalStorageWriteError(code, error);
    throw error;
  }
}

/**
 * Durable boundaries for local-first mutations. The domain record and its
 * outbox entry either commit together or are both rolled back.
 */
export const localMutationStorage = {
  inventory<T>(operation: () => Promise<T>) {
    return run([db.inventoryItems, db.syncQueue], operation);
  },

  category<T>(operation: () => Promise<T>) {
    return run([db.categories, db.syncQueue], operation);
  },

  label<T>(operation: () => Promise<T>) {
    return run([db.labels, db.inventoryItems, db.syncQueue], operation);
  },

  barcode<T>(operation: () => Promise<T>) {
    return run([db.barcodes, db.syncQueue], operation);
  },

  movement<T>(operation: () => Promise<T>) {
    return run([db.inventoryItems, db.inventoryMovements, db.syncQueue], operation);
  },

  recovery<T>(operation: () => Promise<T>) {
    return run([db.syncQueue, db.recoveryItems], operation);
  },
};
