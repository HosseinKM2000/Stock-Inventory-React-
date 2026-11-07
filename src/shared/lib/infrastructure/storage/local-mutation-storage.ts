import { db } from "./db";

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
  try {
    return await db.transaction("rw", tables, operation);
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
};
