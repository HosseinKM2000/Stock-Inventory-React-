import { getPackagingBreakdown, packagingOf } from "@/features/app/inventory/domain/packaging";
import type { Product } from "@/features/app/inventory/types";

export function formatProductQuantity(product: Product) {
  const quantity = product.quantity.toLocaleString("fa-IR");
  const packaging = packagingOf(product.catalog_product);
  if (!packaging.isPackaged) return `${quantity} عدد`;
  const breakdown = getPackagingBreakdown(product.quantity, packaging.packSize);
  const remaining = breakdown.remainingUnits > 0
    ? ` و ${breakdown.remainingUnits.toLocaleString("fa-IR")} واحد`
    : "";
  return `${quantity} واحد (${breakdown.completePackages.toLocaleString("fa-IR")} بسته${remaining})`;
}
