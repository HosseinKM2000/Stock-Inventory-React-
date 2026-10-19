import { isProductEligible } from "@/features/app/inventory/domain/product-eligibility";
import type { Product } from "@/features/app/inventory/types";
import type { Category, Label } from "@/features/setting/types";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

export type RankedProductValue = { product: Product; value: number };
export type RankedCategoryValue = {
  categoryId: number;
  name: string;
  productCount: number;
  value: number;
};

export type ClassificationResult = {
  withoutCategory: Product[];
  withoutLabel: Product[];
  distinctCount: number;
};

export type DashboardAction = {
  kind: "out-of-stock" | "low-stock" | "no-price" | "classification";
  title: string;
  count: number;
  to:
    | "/dashboard/products/out-of-stock"
    | "/dashboard/products/low-stock"
    | "/dashboard/products/no-price"
    | "/dashboard/products/unclassified";
};

export type TodayActions = {
  sync: { count: number; to: "/tools/recovery" } | null;
  inventory: DashboardAction[];
};

export function selectEligibleProducts(
  products: readonly Product[],
  hideCatalogProducts: boolean,
): Product[] {
  return products.filter((product) =>
    isProductEligible(product, { hideCatalogProducts }),
  );
}

export function hasMissingPrice(product: Product): boolean {
  return product.price_missing === true || !Number.isFinite(product.price);
}

export function inventoryValue(product: Product): number | null {
  if (hasMissingPrice(product)) return null;
  if (!Number.isSafeInteger(product.quantity) || product.quantity < 0) return null;
  if (!Number.isSafeInteger(product.price) || product.price < 0) return null;
  const value = product.quantity * product.price;
  return Number.isSafeInteger(value) ? value : null;
}

export function rankProductsByInventoryValue(
  products: readonly Product[],
  limit = 10,
): RankedProductValue[] {
  return products
    .flatMap((product) => {
      const value = inventoryValue(product);
      return value !== null && value > 0 ? [{ product, value }] : [];
    })
    .sort((left, right) => right.value - left.value || left.product.id - right.product.id)
    .slice(0, limit);
}

export function aggregateCategoriesByInventoryValue(
  products: readonly Product[],
  categories: readonly Category[],
  limit = 10,
) {
  const validCategories = new Map(categories.map((category) => [category.id, category]));
  const aggregates = new Map<number, RankedCategoryValue>();
  let excludedUncategorizedValue = 0;
  let missingPriceCount = 0;

  for (const product of products) {
    const category = product.category_id == null
      ? undefined
      : validCategories.get(product.category_id);
    const value = inventoryValue(product);
    if (hasMissingPrice(product)) missingPriceCount += 1;

    if (!category) {
      if (value !== null) excludedUncategorizedValue += value;
      continue;
    }

    const current = aggregates.get(category.id) ?? {
      categoryId: category.id,
      name: category.name,
      productCount: 0,
      value: 0,
    };
    current.productCount += 1;
    if (value !== null) current.value += value;
    aggregates.set(category.id, current);
  }

  return {
    categories: [...aggregates.values()]
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value || left.categoryId - right.categoryId)
      .slice(0, limit),
    excludedUncategorizedValue,
    missingPriceCount,
  };
}

export function classifyProducts(
  products: readonly Product[],
  categories: readonly Category[],
  labels: readonly Label[],
): ClassificationResult {
  const categoryIds = new Set(categories.map((category) => category.id));
  const labelIds = new Set(labels.map((label) => label.id));
  const withoutCategory: Product[] = [];
  const withoutLabel: Product[] = [];
  const distinct = new Set<number>();

  for (const product of products) {
    const missingCategory =
      product.category_id == null || !categoryIds.has(product.category_id);
    const missingLabel =
      !product.label_ids?.some((labelId) => labelIds.has(labelId));
    if (missingCategory) {
      withoutCategory.push(product);
      distinct.add(product.id);
    }
    if (missingLabel) {
      withoutLabel.push(product);
      distinct.add(product.id);
    }
  }

  return { withoutCategory, withoutLabel, distinctCount: distinct.size };
}

export function buildTodayActions(
  products: readonly Product[],
  classification: ClassificationResult,
  queue: readonly SyncQueueItem[],
): TodayActions {
  const problematic = queue.filter((item) =>
    item.status === "conflict" ||
    item.status === "fatal_error" ||
    item.status === "dead_letter",
  );
  const outOfStock = products.filter((product) => product.status === "out_of_stock").length;
  const lowStock = products.filter((product) => product.status === "low_stock").length;
  const noPrice = products.filter(hasMissingPrice).length;
  const inventory: DashboardAction[] = [];

  if (outOfStock > 0) inventory.push({
    kind: "out-of-stock", title: "تکمیل موجودی کالاهای ناموجود",
    count: outOfStock, to: "/dashboard/products/out-of-stock",
  });
  if (lowStock > 0) inventory.push({
    kind: "low-stock", title: "بررسی کالاهای کم‌موجود",
    count: lowStock, to: "/dashboard/products/low-stock",
  });
  if (noPrice > 0) inventory.push({
    kind: "no-price", title: "ثبت قیمت‌های ناقص",
    count: noPrice, to: "/dashboard/products/no-price",
  });
  if (classification.distinctCount > 0) inventory.push({
    kind: "classification", title: "تکمیل دسته‌بندی یا برچسب",
    count: classification.distinctCount, to: "/dashboard/products/unclassified",
  });

  return {
    sync: problematic.length > 0
      ? { count: problematic.length, to: "/tools/recovery" }
      : null,
    inventory,
  };
}
