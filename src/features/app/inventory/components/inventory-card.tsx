import { Link, useNavigate } from "@tanstack/react-router";
import { Badge, Card, Flex, IconButton, Text } from "@radix-ui/themes";
import { EyeOpenIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";
import productPlaceholder from "@/assets/product-placeholder.svg";
import { useImage } from "@/shared/lib/infrastructure/media/useImage";
import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import { getPackagingBreakdown, packagingOf } from "../domain/packaging";
import { useLongPress } from "../hooks/use-long-press";
import type { Product, ProductStatus } from "../types";
import type { ProductViewMode } from "../services/inventory-list-preferences";
import { QuickStockAdjustment } from "./quick-stock-adjustment";

const STATUS_META: Record<ProductStatus, { label: string; color: "green" | "yellow" | "red" }> = {
  in_stock: { label: "موجود", color: "green" },
  low_stock: { label: "کم موجود", color: "yellow" },
  out_of_stock: { label: "ناموجود", color: "red" },
};

type Props = {
  product: Product;
  deleting?: boolean;
  viewMode?: ProductViewMode;
  showActions?: boolean;
  showQuickStock?: boolean;
  onDelete?: (id: number) => void;
  onPreview?: (product: Product) => void;
  onEdit?: (product: Product) => void;
};

export function ProductCard({
  product,
  deleting,
  viewMode = "comfortable",
  showActions = true,
  showQuickStock = true,
  onDelete,
  onPreview,
  onEdit,
}: Props) {
  useEntitlementAccess();
  const navigate = useNavigate();
  const canWrite = accessState.canWrite();
  const status = STATUS_META[product.status];
  const packaging = packagingOf(product.catalog_product);
  const packageBreakdown = packaging.isPackaged
    ? getPackagingBreakdown(product.quantity, packaging.packSize)
    : null;
  const imagePreview = useImage(product.image_url ?? product.catalog_product?.image_url) ?? productPlaceholder;
  const name = product.custom_label ?? product.catalog_product?.name ?? "محصول بدون نام";
  const longPress = useLongPress(() => onPreview?.(product));

  const edit = () => {
    onEdit?.(product);
    void navigate({ to: "/inventory/edit", search: { id: product.id } });
  };

  const image = (className: string) => (
    <button
      type="button"
      className={`${className} relative block touch-pan-y overflow-hidden bg-[var(--gray-a3)] text-start`}
      aria-label={`پیش‌نمایش تصویر ${name}`}
      title="برای پیش‌نمایش نگه دارید یا کلیک کنید"
      onClick={(event) => { event.stopPropagation(); onPreview?.(product); }}
      {...longPress}
    >
      <img
        src={imagePreview}
        alt={name}
        draggable={false}
        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = productPlaceholder; }}
        className="h-full w-full object-cover"
      />
    </button>
  );

  if (viewMode !== "comfortable") {
    return (
      <Card
        size="1"
        role="button"
        tabIndex={0}
        aria-label={`ویرایش ${name}`}
        className={`inventory-card inventory-card--${viewMode} cursor-pointer overflow-hidden transition-shadow hover:shadow-md`}
        onClick={edit}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); edit(); }
        }}
      >
        <Flex align="center" gap="3" className="min-w-0">
          {image(viewMode === "grid" ? "h-20 w-20 shrink-0 rounded-lg" : "h-14 w-14 shrink-0 rounded-lg")}
          <Flex direction="column" gap="1" className="min-w-0 flex-1">
            <Text weight="bold" className="truncate">{name}</Text>
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="1" color="gray">{product.quantity.toLocaleString("fa-IR")} عدد</Text>
              <Badge size="1" color={status.color}>{status.label}</Badge>
            </Flex>
          </Flex>
        </Flex>
      </Card>
    );
  }

  return (
    <Card
      size="2"
      className={`inventory-card h-auto overflow-hidden transition-all duration-200 ${showActions ? "" : "inventory-card--readonly"}`}
    >
      <Flex className="inventory-card-layout min-w-0" dir="rtl">
        {image("inventory-card-image shrink-0")}
        <Flex direction="column" justify="between" className="inventory-card-content min-w-0 flex-1 p-3 sm:p-4">
          <Flex justify="between" align="start" gap="2" className="min-w-0">
            <Flex direction="column" gap="1" className="min-w-0 flex-1">
              <Text weight="bold" size="3" className="break-words text-lg!">{name}</Text>
              {product.catalog_product?.brand && <Text size="1" color="gray" className="break-words">{product.catalog_product.brand}</Text>}
            </Flex>
            <Badge color={status.color} className="inventory-card-mobile-status shrink-0">{status.label}</Badge>
          </Flex>
          <Text size="2" color="gray" className="line-clamp-2 break-words">
            {product.note ?? product.catalog_product?.description ?? "بدون توضیح"}
          </Text>
          {packageBreakdown && (
            <Flex gap="3" wrap="wrap">
              <Text size="2"><Text color="gray">بسته: </Text>{packageBreakdown.completePackages.toLocaleString("fa-IR")}</Text>
              <Text size="2"><Text color="gray">تعداد کل: </Text>{product.quantity.toLocaleString("fa-IR")}</Text>
            </Flex>
          )}
          <Flex justify="between" gap="3" className="inventory-card-footer min-w-0">
            <Badge size="3" color="green" className="inventory-card-price max-w-full overflow-hidden">
              {product.price.toLocaleString("fa-IR")} تومان
            </Badge>
            {showActions && <Flex gap="2" justify="end" className="inventory-card-actions inventory-card-mobile-actions">
              <IconButton type="button" size="2" variant="soft" aria-label={`پیش‌نمایش ${name}`} onClick={() => onPreview?.(product)}><EyeOpenIcon /></IconButton>
              <Link to="/inventory/edit" search={{ id: product.id }} onClick={() => onEdit?.(product)}>
                <Button size="2" variant="soft" color="amber" className="inventory-card-edit-button" aria-label={`ویرایش ${name}`}><Pencil1Icon width={20} height={20} /></Button>
              </Link>
              <Button
                size="2" color="red" variant="soft" loading={deleting}
                disabled={!canWrite || product.is_catalog_backed}
                title={product.is_catalog_backed ? "محصولات کاتالوگی قابل حذف نیستند؛ آن‌ها را مخفی کنید." : undefined}
                onClick={() => onDelete?.(product.id)} aria-label={`حذف ${name}`}
              ><TrashIcon width={23} height={23} /></Button>
            </Flex>}
          </Flex>
        </Flex>
        {showActions && <div className="inventory-card-controls">
          {showQuickStock && <div className="inventory-card-quick shrink-0 border-[var(--gray-a5)] bg-[var(--gray-a2)]">
            <QuickStockAdjustment key={`${product.id}-${product.catalog_product?.is_packaged}-${product.catalog_product?.pack_size ?? "none"}`} product={product} />
          </div>}
          <Flex align="center" gap="3" className="inventory-card-desktop-end">
            <Badge color={status.color} className="inventory-card-desktop-status shrink-0">{status.label}</Badge>
            <Flex gap="2" className="inventory-card-actions">
              <IconButton type="button" size="2" variant="soft" aria-label={`پیش‌نمایش ${name}`} onClick={() => onPreview?.(product)}><EyeOpenIcon /></IconButton>
              <Link to="/inventory/edit" search={{ id: product.id }} onClick={() => onEdit?.(product)}>
                <Button size="2" variant="soft" color="amber" aria-label={`ویرایش ${name}`}><Pencil1Icon width={20} height={20} /></Button>
              </Link>
              <Button size="2" color="red" variant="soft" loading={deleting} disabled={!canWrite || product.is_catalog_backed} onClick={() => onDelete?.(product.id)} aria-label={`حذف ${name}`}><TrashIcon width={23} height={23} /></Button>
            </Flex>
          </Flex>
        </div>}
      </Flex>
    </Card>
  );
}
