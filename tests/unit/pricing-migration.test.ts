import { describe, expect, it } from "vitest";
import { migrateLegacyProductPricing, migrateLegacyQueuedPricing } from "@/shared/lib/infrastructure/storage/db";
import { product } from "../helpers/product";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

describe("local pricing migration", () => {
  it("moves legacy price to sale price and leaves purchase price unknown", () => {
    const migrated = migrateLegacyProductPricing(product({ price: 42, sale_price: undefined, purchase_price: undefined }) as never);
    expect(migrated).toMatchObject({ sale_price: 42, purchase_price: null, price: 42, price_missing: false });
  });

  it("converts legacy queued price updates without adding a purchase price", () => {
    const queue = { entity: "product", payload: { id: 7, price: 90 }, action: "UPDATE" } as SyncQueueItem;
    const migrated = migrateLegacyQueuedPricing(queue);
    expect(migrated.payload).toEqual({ id: 7, price: 90, sale_price: 90 });
  });
});
