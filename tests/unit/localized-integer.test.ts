import { describe, expect, it } from "vitest";
import {
  formatGroupedIntegerText,
  normalizeIntegerText,
  normalizeOptionalInteger,
} from "@/features/app/inventory/services/localized-integer";

describe("localized integer presentation", () => {
  it("normalizes localized digits and removes display separators", () => {
    expect(normalizeIntegerText("۱٬۲۳۴,۵۶۷")).toBe("1234567");
    expect(normalizeOptionalInteger("۱٬۲۳۴,۵۶۷")).toBe(1_234_567);
  });

  it("groups digits for display without changing the numeric payload", () => {
    expect(formatGroupedIntegerText("1234567")).toBe("1,234,567");
    expect(formatGroupedIntegerText(0)).toBe("0");
    expect(formatGroupedIntegerText("")).toBe("");
  });
});
