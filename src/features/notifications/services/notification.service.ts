import type { Product } from "@/features/app/inventory/types";
import type { InventoryNotification } from "../types";

function productName(product: Product): string {
  return product.custom_label?.trim() || product.catalog_product?.name?.trim() || "محصول بدون نام";
}

function deriveProductNotification(product: Product): InventoryNotification | null {
  if (product.deleted_at || product.is_hidden) return null;

  const name = productName(product);
  const base = {
    id: `inventory-alert-${product.id}`,
    productId: product.id,
    productName: name,
    context: `موجودی فعلی: ${product.quantity.toLocaleString("fa-IR")}`,
  };

  if (product.quantity <= 0 || product.status === "out_of_stock") {
    return {
      ...base,
      kind: "out_of_stock",
      severity: "critical",
      title: "عدم موجودی",
      description: `محصول «${name}» ناموجود شده است.`,
    };
  }

  if (
    product.low_stock_alert &&
    product.low_stock_threshold > 0 &&
    product.quantity <= product.low_stock_threshold
  ) {
    return {
      ...base,
      kind: "urgent_purchase",
      severity: "critical",
      title: "نیاز به خرید فوری",
      description: `موجودی «${name}» به حد بحرانی خرید رسیده است.`,
      context: `${base.context} · حد هشدار: ${product.low_stock_threshold.toLocaleString("fa-IR")}`,
    };
  }

  if (product.status === "low_stock") {
    return {
      ...base,
      kind: "low_stock",
      severity: "warning",
      title: "کمبود موجودی",
      description: `موجودی «${name}» کمتر از حد مطلوب است.`,
      context: `${base.context} · حد هشدار: ${product.low_stock_threshold.toLocaleString("fa-IR")}`,
    };
  }

  return null;
}

export const notificationService = {
  derive(products: readonly Product[]): InventoryNotification[] {
    return products
      .map(deriveProductNotification)
      .filter((item): item is InventoryNotification => item !== null)
      .sort((left, right) => {
        if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
        return left.productName.localeCompare(right.productName, "fa");
      });
  },
};
