import { describe, expect, it } from "vitest";
import {
  getPackagingBreakdown,
  getUnitsForOperation,
  packagingOf,
  validPackSize,
} from "@/features/app/inventory/domain/packaging";

describe("package quantity rules", () => {
  it.each([1, 10, Number.MAX_SAFE_INTEGER])("accepts positive safe pack size %s", (size) => {
    expect(validPackSize(size)).toBe(true);
  });

  it.each([0, -1, 1.5, NaN, Infinity, "10", null])("rejects invalid pack size %s", (size) => {
    expect(validPackSize(size)).toBe(false);
  });

  it("derives complete packages and remaining individual units", () => {
    expect(getPackagingBreakdown(105, 10)).toEqual({
      completePackages: 10,
      remainingUnits: 5,
    });
  });

  it("keeps inventory unit-based for package and unit adjustments", () => {
    expect(getUnitsForOperation(1, "pack", 10)).toBe(10);
    expect(getUnitsForOperation(-1, "pack", 10)).toBe(-10);
    expect(getUnitsForOperation(1, "unit", 10)).toBe(1);
    expect(getUnitsForOperation(-1, "unit", 10)).toBe(-1);
  });

  it("rejects invalid package operations and unsafe multiplication", () => {
    expect(() => getUnitsForOperation(1, "pack", 0)).toThrow();
    expect(() => getUnitsForOperation(1.5, "unit", null)).toThrow();
    expect(() => getUnitsForOperation(Number.MAX_SAFE_INTEGER, "pack", 2)).toThrow();
  });

  it("normalizes inconsistent catalog packaging metadata", () => {
    expect(packagingOf({ is_packaged: true, pack_size: 10 } as never)).toEqual({
      isPackaged: true,
      packSize: 10,
    });
    expect(packagingOf({ is_packaged: true, pack_size: 0 } as never)).toEqual({
      isPackaged: false,
      packSize: null,
    });
  });
});
