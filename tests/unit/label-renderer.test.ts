import { describe, expect, it } from "vitest";

import { renderLabelDocument, validateLabelFit } from "@/features/barcode/labels/label-renderer";
import type { LabelProfile, ProductBarcode } from "@/features/barcode/types";
import { createProductInitialValues } from "@/features/app/inventory/form/product-form.initial";

const profile: LabelProfile = { id: "test", name: "test", kind: "thermal", widthMm: 50, heightMm: 30, marginMm: 2, horizontalGapMm: 0, verticalGapMm: 0, columns: 1, showPrice: true, showStoreName: false, showPackageQuantity: true };
const barcode: ProductBarcode = { id: 1, product_id: 2, value: "TZ-0123456789AB", source: "tanzim", symbology: "code128", meaning: "package", scan_quantity: 12, is_active: true, is_default: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };

describe("label renderer", () => {
  it("renders exact millimetre dimensions, vector bars, Persian text and requested copies", async () => {
    const product = { ...createProductInitialValues(), id: 2, custom_label: "پیچ صنعتی", price: 125000 };
    const html = await renderLabelDocument([{ product, barcode, copies: 2 }], profile);
    expect(html).toContain("width:50mm;height:30mm");
    expect(html).toContain("<svg");
    expect(html).toContain("پیچ صنعتی");
    expect(html.match(/<article/g)).toHaveLength(2);
  });

  it("rejects values whose modules cannot fit the configured quiet-zone width", () => {
    expect(() => validateLabelFit("X".repeat(64), { ...profile, widthMm: 20 })).toThrow(/عرض لیبل/);
  });
});
