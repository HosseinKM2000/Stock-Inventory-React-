import type { CatalogProduct } from "../types";

export type QuantityOperationMode = "unit" | "pack";

export function validPackSize(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

export function packagingOf(product: CatalogProduct | null | undefined) {
  if (product?.is_packaged === true && validPackSize(product.pack_size)) {
    return { isPackaged: true as const, packSize: product.pack_size };
  }
  return { isPackaged: false as const, packSize: null };
}

export function getPackagingBreakdown(quantity: number, packSize: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || !validPackSize(packSize)) {
    return { completePackages: 0, remainingUnits: Math.max(0, quantity || 0) };
  }
  return {
    completePackages: Math.floor(quantity / packSize),
    remainingUnits: quantity % packSize,
  };
}

export function getUnitsForOperation(
  amount: number,
  mode: QuantityOperationMode,
  packSize: number | null,
) {
  if (!Number.isSafeInteger(amount)) throw new Error("مقدار تغییر موجودی نامعتبر است");
  if (mode === "unit") return amount;
  if (!validPackSize(packSize)) throw new Error("تعداد واحد در هر بسته نامعتبر است");
  const units = amount * packSize;
  if (!Number.isSafeInteger(units)) throw new Error("مقدار تغییر موجودی بیش از حد مجاز است");
  return units;
}
