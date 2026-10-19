import { describe, expect, it } from "vitest";
import {
  buildBulkProductIntent,
  normalizeOptionalInteger,
} from "@/features/app/inventory/services/bulk-edit-intent";

describe("bulk-edit intent", () => {
  it("does not turn the initial category choice into category removal", () => {
    expect(buildBulkProductIntent({
      category: "unchanged",
      priceIncrease: "",
      alert: "unchanged",
      threshold: "",
    })).toEqual({});
  });

  it("keeps explicit category removal distinct from no change", () => {
    expect(buildBulkProductIntent({
      category: "remove",
      priceIncrease: "",
      alert: "unchanged",
      threshold: "",
    })).toEqual({ categoryId: null });
  });

  it("omits empty numbers, keeps a zero threshold, and ignores a zero price increase", () => {
    expect(buildBulkProductIntent({
      category: "unchanged",
      priceIncrease: "۰",
      alert: "unchanged",
      threshold: "٠",
    })).toEqual({ lowStockThreshold: 0 });
  });

  it("normalizes Persian and Arabic digits without inventing a value for empty input", () => {
    expect(normalizeOptionalInteger("۱۲٬۳٤")).toBe(1234);
    expect(normalizeOptionalInteger("  ")).toBeUndefined();
  });
});
