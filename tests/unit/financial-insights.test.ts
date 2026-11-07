import { describe, expect, it } from "vitest";
import { calculateFinancialInsights } from "@/features/app/dashboard/services/financial-insights";
import { product } from "../helpers/product";

describe("financial inventory insights", () => {
  it("keeps unknown and zero prices distinct and uses one eligible population", () => {
    const result = calculateFinancialInsights([
      product({ id: 1, quantity: 2, sale_price: 150, purchase_price: 100 }),
      product({ id: 2, quantity: 3, sale_price: 0, purchase_price: 0 }),
      product({ id: 3, quantity: 4, sale_price: null, purchase_price: 20, price_missing: true }),
      product({ id: 4, quantity: 5, sale_price: 10, purchase_price: null }),
    ], []);

    expect(result.purchaseInventoryValue).toBe(280n);
    expect(result.saleInventoryValue).toBe(350n);
    expect(result.eligibleSaleValue).toBe(300n);
    expect(result.potentialGrossProfit).toBe(100n);
    expect(result.grossMarginPercent).toBe(33.33);
    expect(result.fullyPricedCount).toBe(2);
    expect(result.missingEitherCount).toBe(2);
  });

  it("uses bigint totals for values beyond Number safe arithmetic", () => {
    const result = calculateFinancialInsights([
      product({ quantity: Number.MAX_SAFE_INTEGER, sale_price: Number.MAX_SAFE_INTEGER, purchase_price: 1 }),
    ], []);
    expect(result.saleInventoryValue).toBe(BigInt(Number.MAX_SAFE_INTEGER) ** 2n);
  });

  it("preserves losses and reports an unavailable margin for a zero sale denominator", () => {
    const result = calculateFinancialInsights([
      product({ quantity: 4, sale_price: 0, purchase_price: 25 }),
    ], []);
    expect(result.potentialGrossProfit).toBe(-100n);
    expect(result.grossMarginPercent).toBeNull();
    expect(result.belowCost).toHaveLength(1);
  });

  it("uses actual-unit quantity for packaged products", () => {
    const base = product();
    const result = calculateFinancialInsights([
      product({ quantity: 13, sale_price: 20, purchase_price: 10, catalog_product: { ...base.catalog_product!, is_packaged: true, pack_size: 6 } }),
    ], []);
    expect(result.purchaseInventoryValue).toBe(130n);
    expect(result.saleInventoryValue).toBe(260n);
  });
});
