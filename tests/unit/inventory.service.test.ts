import { beforeEach, describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn(), getAllStored: vi.fn(),
  enqueue: vi.fn(), requireWrite: vi.fn(), requireInventoryCapacity: vi.fn(), removeImage: vi.fn(),
}));

vi.mock("@/features/app/inventory/services/inventory.repository", () => ({
  inventoryRepository: {
    getAll: mocks.getAll,
    getAllStored: mocks.getAllStored,
    get: mocks.get,
    save: mocks.save,
    remove: mocks.remove,
  },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({ queueService: { enqueue: mocks.enqueue } }));
vi.mock("@/shared/access/access-state", () => ({
  accessState: {
    requireWrite: mocks.requireWrite,
    requireInventoryCapacity: mocks.requireInventoryCapacity,
  },
}));
vi.mock("@/shared/lib/infrastructure/media/image.service", () => ({
  imageService: { remove: mocks.removeImage, removeOrphans: vi.fn() },
}));

import { inventoryService } from "@/features/app/inventory/services/inventory-service";

describe("local-first inventory service", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  it("sanitizes corrupted values and derives boundary stock status", async () => {
    mocks.getAll.mockResolvedValue([
      product({ id: 1, quantity: -4, price: Number.NaN, low_stock_threshold: -2 }),
      product({ id: 2, quantity: 5, low_stock_threshold: 5, status: "in_stock" }),
    ]);
    const records = await inventoryService.getAll();
    expect(records[0]).toMatchObject({ id: 2, quantity: 5, status: "low_stock" });
    expect(records[1]).toMatchObject({ id: 1, quantity: 0, price: 0, low_stock_threshold: 0, status: "out_of_stock" });
  });

  it("adjusts the latest persisted quantity and rejects invalid or negative results", async () => {
    const current = product({ id: 1, quantity: 10 });
    mocks.get.mockResolvedValueOnce(current).mockResolvedValueOnce(current).mockResolvedValueOnce(product({ id: 1, quantity: 15 }));
    mocks.save.mockResolvedValue(undefined);
    await expect(inventoryService.adjustQuantity(1, 5)).resolves.toMatchObject({ quantity: 15 });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 15 }));
    expect(mocks.enqueue).toHaveBeenCalledWith("product", 1, "UPDATE", expect.objectContaining({ quantity: 15 }));

    mocks.get.mockResolvedValueOnce(current);
    await expect(inventoryService.adjustQuantity(1, -11)).rejects.toThrow();
    await expect(inventoryService.adjustQuantity(1, 0)).rejects.toThrow();
  });

  it("removes a replaced local image after the record is safely saved", async () => {
    const current = product({ image_url: "local://old.webp" });
    const updated = product({ image_url: "local://new.webp" });
    mocks.get.mockResolvedValueOnce(current).mockResolvedValueOnce(updated);
    await inventoryService.update(1, { image: null } as never);
    expect(mocks.removeImage).toHaveBeenCalledWith("local://old.webp");
    expect(mocks.enqueue).toHaveBeenCalledOnce();
  });

  it("prevents local deletion of catalog-backed inventory", async () => {
    mocks.get.mockResolvedValue(product({ is_catalog_backed: true }));
    await expect(inventoryService.remove(1)).rejects.toThrow();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
