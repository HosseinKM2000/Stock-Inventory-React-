import { beforeEach, describe, expect, it, vi } from "vitest";

const persistenceKey = "tanzim-storage-persistence-attempted-v1";

function setStorage(storage?: Partial<StorageManager>) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: storage,
  });
}

describe("storage persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("does nothing when the Storage API is unavailable", async () => {
    setStorage(undefined);
    const { storagePersistenceService } = await import("@/shared/lib/infrastructure/storage/storage-persistence.service");
    await expect(storagePersistenceService.ensure()).resolves.toEqual({
      supported: false, persisted: null, requested: false,
    });
  });

  it("does not request persistence when the origin is already persistent", async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    const { storagePersistenceService } = await import("@/shared/lib/infrastructure/storage/storage-persistence.service");
    await expect(storagePersistenceService.ensure()).resolves.toEqual({
      supported: true, persisted: true, requested: false,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistence once and retains a denied decision", async () => {
    const persist = vi.fn().mockResolvedValue(false);
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    const { storagePersistenceService } = await import("@/shared/lib/infrastructure/storage/storage-persistence.service");
    await expect(storagePersistenceService.ensure()).resolves.toEqual({
      supported: true, persisted: false, requested: true,
    });
    await expect(storagePersistenceService.ensure()).resolves.toEqual({
      supported: true, persisted: false, requested: false,
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(persistenceKey)).toBe("1");
  });

  it("handles a rejected persistence request without disrupting startup", async () => {
    setStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockRejectedValue(new Error("denied")),
    });
    const { storagePersistenceService } = await import("@/shared/lib/infrastructure/storage/storage-persistence.service");
    await expect(storagePersistenceService.ensure()).resolves.toEqual({
      supported: true, persisted: false, requested: true,
    });
  });
});
