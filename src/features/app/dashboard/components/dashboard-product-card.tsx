import productPlaceholder from "@/assets/product-placeholder.svg";
import { resolvedProductName } from "@/features/app/inventory/domain/product-eligibility";
import type { Product } from "@/features/app/inventory/types";
import { useResolvedImage } from "@/shared/lib/infrastructure/media/useImage";
import { Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Package, Tag } from "lucide-react";
import { formatProductQuantity } from "../services/dashboard-format";

export type DashboardProductVariant = "total" | "today" | "out" | "low" | "missing-price" | "inventory-value" | "standard";

function salePrice(product: Product) {
  return product.sale_price ?? (product.price_missing ? null : product.price);
}

export function DashboardProductCard({ product, variant, valueLabel, secondaryLabel }: { product: Product; variant: DashboardProductVariant; valueLabel?: string; secondaryLabel?: string }) {
  const imagePath = product.image_url ?? product.catalog_product?.image_url ?? null;
  const image = useResolvedImage(imagePath);
  const sale = salePrice(product);
  const total = sale == null ? null : BigInt(product.quantity) * BigInt(sale);
  const compact = variant === "total";
  const secondary = secondaryLabel ?? (variant === "low"
    ? `موجودی ${formatProductQuantity(product)} · حداقل ${product.low_stock_threshold.toLocaleString("fa-IR")}`
    : variant === "out" ? "موجودی صفر"
    : variant === "missing-price" ? "قیمت فروش ثبت نشده"
    : variant === "inventory-value" ? `قیمت فروش واحد: ${sale == null ? "نامشخص" : `${sale.toLocaleString("fa-IR")} تومان`}`
    : compact ? formatProductQuantity(product)
    : `${formatProductQuantity(product)}${sale == null ? "" : ` · ${sale.toLocaleString("fa-IR")} تومان`}`);
  const emphasis = valueLabel ?? (variant === "inventory-value" ? (total == null ? "ارزش نامشخص" : `${total.toLocaleString("fa-IR")} تومان`) : null);
  const Icon = variant === "low" || variant === "out" ? CircleAlert : variant === "missing-price" ? Tag : Package;

  return <Link to="/inventory/edit" search={{ id: product.id }} className={`dashboard-product-card dashboard-product-card--${variant} block`}>
    <Card size="1" className="transition-colors hover:bg-[var(--accent-a2)]">
      <Flex align="center" gap="3" className="min-w-0">
        {!compact && <img src={image.src ?? productPlaceholder} alt="" className="dashboard-product-thumbnail shrink-0 object-cover" />}
        <Flex direction="column" gap="1" className="min-w-0 flex-1">
          <Text weight="bold" className="break-words">{resolvedProductName(product)}</Text>
          <Text size="2" color={variant === "out" || variant === "low" ? "red" : "gray"}><Icon size={15} aria-hidden="true" className="inline-block align-middle" /> {secondary}</Text>
        </Flex>
        {emphasis && <Text weight="bold" color="green" className="shrink-0">{emphasis}</Text>}
      </Flex>
    </Card>
  </Link>;
}
