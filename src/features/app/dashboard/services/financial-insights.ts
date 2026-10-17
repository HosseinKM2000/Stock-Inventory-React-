import type { Product } from "@/features/app/inventory/types";
import type { Category } from "@/features/setting/types";

export type FinancialProduct = {
  product: Product;
  purchaseValue: bigint | null;
  saleValue: bigint | null;
  potentialProfit: bigint | null;
  unitDifference: number | null;
};

export type FinancialInsights = {
  purchaseInventoryValue: bigint;
  saleInventoryValue: bigint;
  eligibleSaleValue: bigint;
  potentialGrossProfit: bigint;
  grossMarginPercent: number | null;
  missingPurchaseCount: number;
  missingSaleCount: number;
  missingEitherCount: number;
  fullyPricedCount: number;
  products: FinancialProduct[];
  highestPotentialProfit: FinancialProduct[];
  belowCost: FinancialProduct[];
  categoryContribution: Array<{ categoryId: number | null; name: string; potentialProfit: bigint; productCount: number }>;
};

const valueOf = (quantity: number, price: number | null | undefined) =>
  price == null || !Number.isSafeInteger(quantity) || !Number.isSafeInteger(price)
    ? null
    : BigInt(quantity) * BigInt(price);

export function calculateFinancialInsights(products: Product[], categories: Category[]): FinancialInsights {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const rows: FinancialProduct[] = [];
  let purchaseInventoryValue = 0n;
  let saleInventoryValue = 0n;
  let eligibleSaleValue = 0n;
  let potentialGrossProfit = 0n;
  let missingPurchaseCount = 0;
  let missingSaleCount = 0;
  let missingEitherCount = 0;
  const categoryMap = new Map<number | null, { potentialProfit: bigint; productCount: number }>();

  for (const product of products) {
    const purchase = product.purchase_price ?? null;
    const sale = product.sale_price ?? (product.price_missing ? null : product.price);
    const purchaseValue = valueOf(product.quantity, purchase);
    const saleValue = valueOf(product.quantity, sale);
    const potentialProfit = purchaseValue == null || saleValue == null ? null : saleValue - purchaseValue;
    const unitDifference = purchase == null || sale == null ? null : sale - purchase;
    if (purchaseValue == null) missingPurchaseCount += 1; else purchaseInventoryValue += purchaseValue;
    if (saleValue == null) missingSaleCount += 1; else saleInventoryValue += saleValue;
    if (purchaseValue == null || saleValue == null) missingEitherCount += 1;
    if (potentialProfit != null) {
      eligibleSaleValue += saleValue!;
      potentialGrossProfit += potentialProfit;
      const current = categoryMap.get(product.category_id) ?? { potentialProfit: 0n, productCount: 0 };
      current.potentialProfit += potentialProfit;
      current.productCount += 1;
      categoryMap.set(product.category_id, current);
    }
    rows.push({ product, purchaseValue, saleValue, potentialProfit, unitDifference });
  }

  return {
    purchaseInventoryValue,
    saleInventoryValue,
    eligibleSaleValue,
    potentialGrossProfit,
    grossMarginPercent: eligibleSaleValue === 0n ? null : Number((potentialGrossProfit * 10_000n) / eligibleSaleValue) / 100,
    missingPurchaseCount,
    missingSaleCount,
    missingEitherCount,
    fullyPricedCount: products.length - missingEitherCount,
    products: rows,
    highestPotentialProfit: rows.filter((row) => row.potentialProfit != null).toSorted((a, b) => a.potentialProfit! > b.potentialProfit! ? -1 : a.potentialProfit! < b.potentialProfit! ? 1 : 0),
    belowCost: rows.filter((row) => row.unitDifference != null && row.unitDifference < 0).toSorted((a, b) => a.unitDifference! - b.unitDifference!),
    categoryContribution: [...categoryMap.entries()].map(([categoryId, value]) => ({ categoryId, name: categoryId == null ? "بدون دسته‌بندی" : categoryNames.get(categoryId) ?? "دسته‌بندی حذف‌شده", ...value })).toSorted((a, b) => a.potentialProfit > b.potentialProfit ? -1 : a.potentialProfit < b.potentialProfit ? 1 : 0),
  };
}

export function formatToman(value: bigint) {
  return `${value.toLocaleString("fa-IR")} تومان`;
}
