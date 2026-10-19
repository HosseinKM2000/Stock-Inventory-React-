import type { BulkProductIntent } from "./inventory-service";
import { normalizeOptionalInteger } from "./localized-integer";

export type BulkCategoryChoice = "unchanged" | "remove" | `${number}`;
export type BulkAlertChoice = "unchanged" | "enable" | "disable";

export type BulkEditValues = {
  category: BulkCategoryChoice;
  priceIncrease: string;
  alert: BulkAlertChoice;
  threshold: string;
};

export { normalizeOptionalInteger } from "./localized-integer";

export function buildBulkProductIntent(values: BulkEditValues): BulkProductIntent {
  const priceIncrease = normalizeOptionalInteger(values.priceIncrease);
  const lowStockThreshold = normalizeOptionalInteger(values.threshold);

  return {
    ...(values.category === "remove"
      ? { categoryId: null }
      : values.category !== "unchanged"
        ? { categoryId: Number(values.category) }
        : {}),
    ...(priceIncrease !== undefined && priceIncrease > 0 ? { priceIncrease } : {}),
    ...(values.alert !== "unchanged" ? { lowStockAlert: values.alert === "enable" } : {}),
    ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
  };
}

export function hasBulkProductChanges(intent: BulkProductIntent) {
  return Object.keys(intent).length > 0;
}
