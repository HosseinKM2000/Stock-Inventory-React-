import { beforeEach, describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const { getAll, isHidden } = vi.hoisted(() => ({
  getAll: vi.fn(),
  isHidden: vi.fn(() => false),
}));

vi.mock("@/features/app/inventory/services/inventory-service", () => ({
  inventoryService: { getAll },
}));
vi.mock("@/features/app/inventory/services/catalog-visibility.service", () => ({
  catalogVisibilityService: { isHidden },
}));

import { dashboardService } from "@/features/app/dashboard/services/dashboard.service";
import { DashboardFilters } from "@/features/app/dashboard/types";

describe("local dashboard calculations", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-02T12:00:00Z"));
    isHidden.mockReturnValue(false);
  });

  it("counts product types, value, statuses, and data-quality risks", async () => {
    getAll.mockResolvedValue([
      product({ id: 1, quantity: 10, price: 100, status: "in_stock", image_url: "local://one.webp" }),
      product({ id: 2, quantity: 3, price: 0, status: "low_stock", low_stock_threshold: 3 }),
      product({ id: 3, quantity: 0, price: 500, status: "out_of_stock", low_stock_threshold: 0 }),
      product({ id: 4, quantity: 50, price: 2, is_hidden: true }),
    ]);

    await expect(dashboardService.getStats()).resolves.toMatchObject({
      totalProducts: 3,
      inventoryValue: 1_000,
      lowStockCount: 1,
      outOfStockCount: 1,
      hiddenCount: 1,
      noImageCount: 2,
      noPriceCount: 1,
      urgentPurchaseCount: 2,
      addedTodayCount: 3,
    });
  });

  it("returns empty, zeroed statistics for empty inventory", async () => {
    getAll.mockResolvedValue([]);
    await expect(dashboardService.getStats()).resolves.toEqual({
      totalProducts: 0,
      inventoryValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      hiddenCount: 0,
      noImageCount: 0,
      noPriceCount: 0,
      urgentPurchaseCount: 0,
      addedTodayCount: 0,
    });
  });

  it("uses a catalog image and includes exact low-stock threshold equality", async () => {
    getAll.mockResolvedValue([
      product({
        id: 1,
        quantity: 5,
        low_stock_threshold: 5,
        status: "low_stock",
        catalog_product: { ...product().catalog_product!, image_url: "/uploads/catalog.webp" },
      }),
      product({ id: 2, quantity: 6, low_stock_threshold: 5, status: "in_stock" }),
    ]);
    const low = await dashboardService.getProducts(DashboardFilters.LOW_STOCK);
    const noImage = await dashboardService.getProducts(DashboardFilters.NO_IMAGE);
    expect(low.products.map((item) => item.id)).toEqual([1]);
    expect(noImage.products.map((item) => item.id)).toEqual([2]);
  });

  it("honors per-user catalog visibility while keeping hidden counts", async () => {
    isHidden.mockReturnValue(true);
    getAll.mockResolvedValue([
      product({ id: 1, is_catalog_backed: true }),
      product({ id: 2 }),
      product({ id: 3, is_hidden: true }),
    ]);
    const stats = await dashboardService.getStats();
    expect(stats.totalProducts).toBe(1);
    expect(stats.hiddenCount).toBe(1);
  });
});
