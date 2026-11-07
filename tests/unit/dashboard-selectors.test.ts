import { describe, expect, it } from "vitest";

import {
  aggregateCategoriesByInventoryValue,
  buildTodayActions,
  classifyProducts,
  rankProductsByInventoryValue,
  selectEligibleProducts,
} from "@/features/app/dashboard/services/dashboard-selectors";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { product } from "../helpers/product";

describe("dashboard selectors", () => {
  it("excludes hidden, deleted, inactive, and unresolved catalog products", () => {
    const products = [
      product({ id: 1 }),
      product({ id: 2, is_hidden: true }),
      product({ id: 3, deleted_at: "2026-09-03T00:00:00Z" }),
      product({ id: 4, is_catalog_backed: true, catalog_product: { ...product().catalog_product!, is_active: false } }),
      product({ id: 5, is_catalog_backed: true, catalog_product: undefined }),
      product({ id: 6, is_catalog_backed: true }),
    ];

    expect(selectEligibleProducts(products, false).map((item) => item.id)).toEqual([1, 6]);
  });

  it("ranks safe positive values with deterministic ties and uses actual unit quantity for packages", () => {
    const ranked = rankProductsByInventoryValue([
      product({ id: 8, quantity: 20, price: 50, catalog_product: { ...product().catalog_product!, is_packaged: true, pack_size: 10 } }),
      product({ id: 3, quantity: 10, price: 100 }),
      product({ id: 9, quantity: 2, price: 600 }),
      product({ id: 10, quantity: Number.MAX_SAFE_INTEGER, price: 2 }),
      product({ id: 11, quantity: 2, price: 0 }),
    ]);

    expect(ranked.map(({ product: item, value }) => [item.id, value])).toEqual([
      [9, 1_200],
      [3, 1_000],
      [8, 1_000],
    ]);
  });

  it("aggregates valid categories and reports uncategorized and incomplete values separately", () => {
    const result = aggregateCategoriesByInventoryValue(
      [
        product({ id: 1, category_id: 7, quantity: 2, price: 100 }),
        product({ id: 2, category_id: 7, quantity: 3, price: 100 }),
        product({ id: 3, category_id: 8, quantity: 5, price: 100 }),
        product({ id: 4, category_id: null, quantity: 4, price: 100 }),
        product({ id: 5, category_id: 99, quantity: 7, price: 100 }),
        product({ id: 6, category_id: 7, price_missing: true }),
      ],
      [
        { id: 7, name: "نوشیدنی", description: "", created_at: "", updated_at: "" },
        { id: 8, name: "خوراکی", description: "", created_at: "", updated_at: "" },
      ],
    );

    expect(result.categories.map((item) => [item.categoryId, item.productCount, item.value])).toEqual([
      [7, 3, 500],
      [8, 1, 500],
    ]);
    expect(result.excludedUncategorizedValue).toBe(1_100);
    expect(result.missingPriceCount).toBe(1);
  });

  it("separates classification modes and counts the distinct union once", () => {
    const result = classifyProducts(
      [
        product({ id: 1, category_id: null, label_ids: [] }),
        product({ id: 2, category_id: 7, label_ids: [] }),
        product({ id: 3, category_id: 99, label_ids: [8] }),
        product({ id: 4, category_id: 7, label_ids: [88] }),
        product({ id: 5, category_id: 7, label_ids: [8] }),
      ],
      [{ id: 7, name: "دسته", description: "", created_at: "", updated_at: "" }],
      [{ id: 8, name: "برچسب", normalized_name: "برچسب", created_at: "", updated_at: "" }],
    );

    expect(result.withoutCategory.map((item) => item.id)).toEqual([1, 3]);
    expect(result.withoutLabel.map((item) => item.id)).toEqual([1, 2, 4]);
    expect(result.distinctCount).toBe(4);
  });

  it("prioritizes synchronization separately and does not duplicate stock conditions", () => {
    const conflict: SyncQueueItem = {
      id: "1:product-1", ownerUserId: 1, operationId: "operation-1",
      entity: "product", entityId: 1, action: "UPDATE", payload: null,
      createdAt: 1, updatedAt: 1, retryCount: 0, status: "conflict",
      nextAttemptAt: Number.MAX_SAFE_INTEGER,
    };
    const actions = buildTodayActions(
      [
        product({ id: 1, status: "out_of_stock", quantity: 0, price_missing: true }),
        product({ id: 2, status: "low_stock", quantity: 2 }),
      ],
      { withoutCategory: [], withoutLabel: [], distinctCount: 0 },
      [conflict],
    );

    expect(actions.sync).toMatchObject({ count: 1, to: "/tools/recovery" });
    expect(actions.inventory.map((item) => item.kind)).toEqual([
      "out-of-stock",
      "low-stock",
      "no-price",
    ]);
  });
});
