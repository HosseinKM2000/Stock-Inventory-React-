import { beforeEach, describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn(), getAllStored: vi.fn(),
  enqueue: vi.fn(), requireWrite: vi.fn(), requireInventoryCapacity: vi.fn(), removeImage: vi.fn(),
  getLabels: vi.fn(),
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
vi.mock("@/shared/lib/infrastructure/storage/label-storage", () => ({
  labelStorage: { getAll: mocks.getLabels },
}));

import { inventoryService } from "@/features/app/inventory/services/inventory-service";

describe("local-first inventory service", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getLabels.mockResolvedValue([]);
  });

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

  it("searches associated label names locally without duplicating products", async () => {
    mocks.getAll.mockResolvedValue([
      product({ id: 1, custom_label: "چای", label_ids: [7, 8] }),
      product({ id: 2, custom_label: "قهوه", label_ids: [] }),
    ]);
    mocks.getLabels.mockResolvedValue([
      { id: 7, name: "  ویژه فروش  " },
      { id: 8, name: "ویژه فروش" },
    ]);
    const result = await inventoryService.getAll({ search: "ویژه   فروش" });
    expect(result.map((item) => item.id)).toEqual([1]);
  });

  it("matches any selected label and combines the label filter with search and category", async () => {
    mocks.getAll.mockResolvedValue([
      product({ id: 1, custom_label: "چای سبز", category_id: 4, label_ids: [7] }),
      product({ id: 2, custom_label: "چای سیاه", category_id: 4, label_ids: [8] }),
      product({ id: 3, custom_label: "قهوه", category_id: 4, label_ids: [9] }),
      product({ id: 4, custom_label: "چای کیسه‌ای", category_id: 5, label_ids: [7] }),
    ]);
    const byLabels = await inventoryService.getAll({ label_ids: [7, 8] });
    expect(new Set(byLabels.map((item) => item.id))).toEqual(new Set([1, 2, 4]));

    const combined = await inventoryService.getAll({
      label_ids: [7, 8], search: "چای", category_id: 4,
    });
    expect(new Set(combined.map((item) => item.id))).toEqual(new Set([1, 2]));
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

  it("applies only requested bulk fields and queues absolute prices once", async () => {
    const first = product({ id: 1, price: 100, category_id: 4, low_stock_alert: true, low_stock_threshold: 7, label_ids: [9] });
    const second = product({ id: 2, price: 250, category_id: null, low_stock_alert: false, low_stock_threshold: 3, label_ids: [8] });
    mocks.get.mockImplementation((id: number) => Promise.resolve(id === 1 ? first : second));
    mocks.save.mockResolvedValue(undefined);
    const updated = await inventoryService.bulkUpdate([1, 2, 2], { priceIncrease: 50, lowStockAlert: false });
    expect(updated).toHaveLength(2);
    expect(updated[0]).toMatchObject({ price: 150, category_id: 4, low_stock_alert: false, low_stock_threshold: 7, label_ids: [9] });
    expect(updated[1]).toMatchObject({ price: 300, category_id: null, low_stock_alert: false, low_stock_threshold: 3, label_ids: [8] });
    expect(mocks.enqueue).toHaveBeenCalledTimes(2);
    expect(mocks.enqueue).toHaveBeenNthCalledWith(1, "product", 1, "UPDATE", expect.objectContaining({ price: 150 }));
  });

  it("updates category and alert threshold independently without erasing labels or alert state", async () => {
    const current = product({
      id: 3, category_id: 4, price: 900, low_stock_alert: false,
      low_stock_threshold: 2, label_ids: [7, 8],
    });
    mocks.get.mockResolvedValue(current);
    mocks.save.mockResolvedValue(undefined);
    const [updated] = await inventoryService.bulkUpdate([3], {
      categoryId: null,
      lowStockThreshold: 12,
    });
    expect(updated).toMatchObject({
      category_id: null, price: 900, low_stock_alert: false,
      low_stock_threshold: 12, label_ids: [7, 8],
    });
  });

  it("keeps the product visible after unrelated bulk edits and excludes it only after an intentional category change", async () => {
    let stored = product({
      id: 6, category_id: 4, price: 500, quantity: 9, label_ids: [7],
      image_url: "local://product.webp", is_hidden: false,
    });
    mocks.get.mockImplementation(() => Promise.resolve(stored));
    mocks.getAll.mockImplementation(() => Promise.resolve([stored]));
    mocks.save.mockImplementation((next) => { stored = next; return Promise.resolve(); });

    await inventoryService.bulkUpdate([6], { priceIncrease: 100, lowStockThreshold: 0 });
    await expect(inventoryService.getAll({ category_id: 4 })).resolves.toHaveLength(1);
    expect(stored).toMatchObject({
      id: 6, category_id: 4, price: 600, quantity: 9, label_ids: [7],
      image_url: "local://product.webp", is_hidden: false,
    });

    await inventoryService.bulkUpdate([6], { categoryId: 5 });
    await expect(inventoryService.getAll({ category_id: 4 })).resolves.toEqual([]);
    await expect(inventoryService.get(6)).resolves.toMatchObject({ id: 6, category_id: 5 });
  });

  it("rejects empty and unsafe bulk changes without writing", async () => {
    await expect(inventoryService.bulkUpdate([1], { priceIncrease: 0 })).rejects.toThrow();
    await expect(inventoryService.bulkUpdate([1], { priceIncrease: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
