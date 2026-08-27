import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/button/button";
import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";

import type { Product, ProductStatus } from "../types";
import { QuickStockAdjustment } from "./quick-stock-adjustment";
import productPlaceholder from "@/assets/product-placeholder.svg";
import { useImage } from "@/shared/lib/infrastructure/media/useImage";

const STATUS_META: Record<
  ProductStatus,
  {
    label: string;
    color: "green" | "yellow" | "red";
  }
> = {
  in_stock: {
    label: "موجود",
    color: "green",
  },
  low_stock: {
    label: "کم موجود",
    color: "yellow",
  },
  out_of_stock: {
    label: "ناموجود",
    color: "red",
  },
};

const PLACEHOLDER = productPlaceholder;

type Props = {
  product: Product;
  deleting?: boolean;
  onDelete: (id: number) => void;
};

export function ProductCard({ product, deleting, onDelete }: Props) {
  const status = STATUS_META[product.status];

  // const image =
  //   resolveAssetUrl(product.catalog_product?.image_url) ?? PLACEHOLDER;

  const imagePreview =
    useImage(product.image_url ?? product.catalog_product?.image_url) ?? PLACEHOLDER;

  return (
    <Card
      size="2"
      className="inventory-card h-auto overflow-hidden transition-all duration-200"
    >
      <Flex
        className="inventory-card-layout min-w-0"
        dir="rtl"
      >
        {/* Image */}
        <div className="inventory-card-image shrink-0">
          <img
            src={imagePreview}
            alt={product?.catalog_product?.name}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = PLACEHOLDER;
            }}
            className="
              w-full
              h-full
              object-cover
            "
          />
        </div>

        {/* Content */}
        <Flex
          direction="column"
          justify="between"
          className="inventory-card-content min-w-0 flex-1 p-3 sm:p-4"
        >
          {/* Header */}
          <Flex justify="between" align="start" gap="2" className="min-w-0">
            <Flex direction="column" gap="1" className="min-w-0 flex-1">
              <Text weight="bold" size="3" className="break-words text-lg!">
                {product?.custom_label ?? product?.catalog_product?.name}
              </Text>

              {product.catalog_product?.brand && (
                <Text size="1" color="gray" className="break-words">
                  {product.catalog_product?.brand}
                </Text>
              )}
            </Flex>

            <Badge color={status.color} className="inventory-card-mobile-status shrink-0">
              {status.label}
            </Badge>
          </Flex>

          {/* Description */}
          <Text size="2" color="gray" className="line-clamp-2 break-words">
            {product?.note ??
              product?.catalog_product?.description ??
              "بدون توضیح"}
          </Text>

          <Flex
            justify="between"
            gap="3"
            className="inventory-card-footer min-w-0"
          >
            {/* Price */}
            <Flex
              gapX={"2"}
              align="center"
              className="max-w-full"
            >
              <Badge
                size="3"
                color="green"
                className="inventory-card-price max-w-full overflow-hidden"
              >
                {product.price.toLocaleString("fa-IR")} تومان
              </Badge>
            </Flex>
            {/* Actions */}
            <Flex
              gap="2"
              justify="end"
              className="inventory-card-actions inventory-card-mobile-actions"
            >
              <Link to="/inventory/edit" search={{ id: product.id }}>
                <Button
                  size="2"
                  variant="soft"
                  color="amber"
                  className="inventory-card-edit-button"
                >
                  <Pencil1Icon width={20} height={20} />
                </Button>
              </Link>

              <Button
                size="2"
                color="red"
                variant="soft"
                loading={deleting}
                disabled={product.is_catalog_backed}
                title={
                  product.is_catalog_backed
                    ? "محصولات کاتالوگی قابل حذف نیستند؛ می‌توانید آن‌ها را مخفی کنید."
                    : undefined
                }
                onClick={() => onDelete(product.id)}
                aria-label={`حذف ${product.custom_label ?? product.catalog_product?.name ?? "محصول"}`}
              >
                <TrashIcon width={23} height={23} />
              </Button>
            </Flex>
          </Flex>
        </Flex>
        {/* Full-width on mobile; one compact horizontal action row on desktop. */}
        <div className="inventory-card-controls">
          <div className="inventory-card-quick shrink-0 border-[var(--gray-a5)] bg-[var(--gray-a2)]">
            <QuickStockAdjustment product={product} />
          </div>

          <Flex align="center" gap="3" className="inventory-card-desktop-end">
            <Badge color={status.color} className="inventory-card-desktop-status shrink-0">
              {status.label}
            </Badge>

            <Flex gap="2" className="inventory-card-actions">
              <Link to="/inventory/edit" search={{ id: product.id }}>
                <Button size="2" variant="soft" color="amber" aria-label="ویرایش محصول">
                  <Pencil1Icon width={20} height={20} />
                </Button>
              </Link>

              <Button
                size="2"
                color="red"
                variant="soft"
                loading={deleting}
                disabled={product.is_catalog_backed}
                onClick={() => onDelete(product.id)}
                aria-label="حذف محصول"
              >
                <TrashIcon width={23} height={23} />
              </Button>
            </Flex>
          </Flex>
        </div>
      </Flex>
    </Card>
  );
}
