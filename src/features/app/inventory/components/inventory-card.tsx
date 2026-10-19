import { Link, useNavigate } from "@tanstack/react-router";
import { Badge, Card, Flex, IconButton, Text } from "@radix-ui/themes";
import { CheckIcon, CopyIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button/button";
import productPlaceholder from "@/assets/product-placeholder.svg";
import { useResolvedImage } from "@/shared/lib/infrastructure/media/useImage";
import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import { getPackagingBreakdown, packagingOf } from "../domain/packaging";
import { useLongPress } from "../hooks/use-long-press";
import type { Product, ProductStatus } from "../types";
import type { ProductViewMode } from "../services/inventory-list-preferences";
import { QuickStockAdjustment } from "./quick-stock-adjustment";
import { copyPlainText, productClipboardText } from "../services/clipboard.service";

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
  onImageOpen?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (product: Product) => void;
  onEnterSelection?: (product: Product) => void;
};

export function ProductCard({
  product,
  deleting,
  viewMode = "comfortable",
  showActions = true,
  showQuickStock = true,
  onDelete,
  onImageOpen,
  onEdit,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  onEnterSelection,
}: Props) {
  useEntitlementAccess();
  const navigate = useNavigate();
  const canWrite = accessState.canWrite();
  const hasPermission = (permission: string) => accessState.hasStorePermission?.(permission) ?? true;
  const canEdit = canWrite && (
    hasPermission("products.edit")
    || hasPermission("products.price.change")
    || hasPermission("products.quantity.change")
  );
  const canDelete = canWrite && hasPermission("products.delete");
  const canAdjustQuantity = canWrite && hasPermission("products.quantity.change");
  const status = STATUS_META[product.status];
  const packaging = packagingOf(product.catalog_product);
  const packageBreakdown = packaging.isPackaged
    ? getPackagingBreakdown(product.quantity, packaging.packSize)
    : null;
  const imagePath = product.image_url ?? product.catalog_product?.image_url ?? null;
  const resolvedImage = useResolvedImage(imagePath);
  const [unavailableImagePath, setUnavailableImagePath] = useState<string | null>(null);
  const imagePreview = resolvedImage.src ?? productPlaceholder;
  const hasViewableImage = Boolean(imagePath && resolvedImage.src && !resolvedImage.error && unavailableImagePath !== imagePath);
  const name = product.custom_label ?? product.catalog_product?.name ?? "محصول بدون نام";
  const longPress = useLongPress(() => onEnterSelection?.(product), 550);

  const edit = () => {
    onEdit?.(product);
    void navigate({ to: "/inventory/edit", search: { id: product.id } });
  };

  const activate = () => selectionMode ? onToggleSelection?.(product) : edit();
  const copy = async () => {
    const text = productClipboardText(name, product.price);
    try {
      await copyPlainText(text);
      toast.success("نام و قیمت محصول کپی شد");
    } catch {
      window.prompt("کپی خودکار در دسترس نیست؛ متن را دستی کپی کنید:", text);
      toast.error("کپی خودکار انجام نشد");
    }
  };

  const image = (className: string) => {
    const content = (
      <img
        src={imagePreview}
        alt={hasViewableImage ? name : ""}
        draggable={false}
        onError={(event) => {
          setUnavailableImagePath(imagePath);
          event.currentTarget.onerror = null;
          event.currentTarget.src = productPlaceholder;
        }}
        className="h-full w-full object-cover"
      />
    );

    if (!hasViewableImage) {
      return <div className={`${className} relative block overflow-hidden bg-[var(--gray-a3)]`} aria-hidden="true">{content}</div>;
    }

    return (
      <button
        type="button"
        className={`${className} relative block touch-pan-y overflow-hidden bg-[var(--gray-a3)] text-start focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-8)]`}
        aria-label={selectionMode ? `${selected ? "لغو انتخاب" : "انتخاب"} ${name}` : `نمایش تصویر ${name}`}
        title={selectionMode ? undefined : "نمایش تصویر در اندازه بزرگ"}
        onClick={(event) => {
          event.stopPropagation();
          if (selectionMode) onToggleSelection?.(product);
          else onImageOpen?.(product);
        }}
        data-product-action="true"
      >
        {content}
      </button>
    );
  };

  if (viewMode !== "comfortable") {
    return (
      <Card
        size="1"
        role="button"
        tabIndex={0}
        aria-label={selectionMode ? `${selected ? "لغو انتخاب" : "انتخاب"} ${name}` : `ویرایش ${name}`}
        aria-pressed={selectionMode ? selected : undefined}
        className={`inventory-card inventory-card--${viewMode} cursor-pointer overflow-hidden transition-shadow hover:shadow-md ${selected ? "inventory-card--selected" : ""}`}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
        }}
        {...longPress}
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
          {selectionMode && <Flex align="center" justify="center" data-selected={selected} className="inventory-selection-mark h-7 w-7 rounded-full border" aria-hidden="true">{selected && <CheckIcon />}</Flex>}
        </Flex>
      </Card>
    );
  }

  return (
    <Card
      size="2"
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? selected : undefined}
      aria-label={selectionMode ? `${selected ? "لغو انتخاب" : "انتخاب"} ${name}` : `انتخاب ${name} با نگه‌داشتن`}
      className={`inventory-card h-auto overflow-hidden transition-all duration-200 ${showActions ? "" : "inventory-card--readonly"} ${selected ? "inventory-card--selected" : ""}`}
      onClick={() => { if (selectionMode) onToggleSelection?.(product); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selectionMode) onToggleSelection?.(product);
          else onEnterSelection?.(product);
        }
      }}
      {...longPress}
    >
      <Flex className="inventory-card-layout min-w-0" dir="rtl">
        {image("inventory-card-image shrink-0")}
        <Flex direction="column" justify="between" className="inventory-card-content min-w-0 flex-1 p-3 sm:p-4">
          <Flex justify="between" align="start" gap="2" className="min-w-0">
            <Flex direction="column" gap="1" className="min-w-0 flex-1">
              <Text weight="bold" size="3" className="break-words text-lg!">{name}</Text>
              {product.catalog_product?.brand && <Text size="1" color="gray" className="break-words">{product.catalog_product.brand}</Text>}
            </Flex>
            {selectionMode ? <Flex align="center" justify="center" data-selected={selected} className="inventory-selection-mark h-8 w-8 shrink-0 rounded-full border" aria-hidden="true">{selected && <CheckIcon />}</Flex> : <Badge color={status.color} className="inventory-card-mobile-status shrink-0">{status.label}</Badge>}
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
              {product.price_missing
                ? "قیمت ثبت نشده"
                : `${product.price.toLocaleString("fa-IR")} تومان`}
            </Badge>
            {showActions && !selectionMode && <Flex gap="2" justify="end" data-product-action className="inventory-card-actions inventory-card-mobile-actions">
              <IconButton type="button" size="2" variant="soft" aria-label={`کپی نام و قیمت ${name}`} onClick={(event) => { event.stopPropagation(); void copy(); }}><CopyIcon /></IconButton>
              {canEdit && <Link to="/inventory/edit" search={{ id: product.id }} onClick={() => onEdit?.(product)}>
                <Button size="2" variant="soft" color="amber" className="inventory-card-edit-button" aria-label={`ویرایش ${name}`}><Pencil1Icon width={20} height={20} /></Button>
              </Link>}
              {canDelete && <Button
                size="2" color="red" variant="soft" loading={deleting}
                disabled={product.is_catalog_backed}
                title={product.is_catalog_backed ? "محصولات کاتالوگی قابل حذف نیستند؛ آن‌ها را مخفی کنید." : undefined}
                onClick={() => onDelete?.(product.id)} aria-label={`حذف ${name}`}
              ><TrashIcon width={23} height={23} /></Button>}
            </Flex>}
          </Flex>
        </Flex>
        {showActions && !selectionMode && <div className="inventory-card-controls" data-product-action>
          {showQuickStock && canAdjustQuantity && <div className="inventory-card-quick shrink-0 border-[var(--gray-a5)] bg-[var(--gray-a2)]">
            <QuickStockAdjustment key={`${product.id}-${product.catalog_product?.is_packaged}-${product.catalog_product?.pack_size ?? "none"}`} product={product} />
          </div>}
          <Flex align="center" gap="3" className="inventory-card-desktop-end">
            <Badge color={status.color} className="inventory-card-desktop-status shrink-0">{status.label}</Badge>
            <Flex gap="2" className="inventory-card-actions">
              <IconButton type="button" size="2" variant="soft" aria-label={`کپی نام و قیمت ${name}`} onClick={(event) => { event.stopPropagation(); void copy(); }}><CopyIcon /></IconButton>
              {canEdit && <Link to="/inventory/edit" search={{ id: product.id }} onClick={() => onEdit?.(product)}>
                <Button size="2" variant="soft" color="amber" aria-label={`ویرایش ${name}`}><Pencil1Icon width={20} height={20} /></Button>
              </Link>}
              {canDelete && <Button size="2" color="red" variant="soft" loading={deleting} disabled={product.is_catalog_backed} onClick={() => onDelete?.(product.id)} aria-label={`حذف ${name}`}><TrashIcon width={23} height={23} /></Button>}
            </Flex>
          </Flex>
        </div>}
      </Flex>
    </Card>
  );
}
