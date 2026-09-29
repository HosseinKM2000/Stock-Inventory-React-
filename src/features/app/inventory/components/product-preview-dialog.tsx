import { Cross1Icon } from "@radix-ui/react-icons";
import { Badge, Dialog, Flex, IconButton, Text } from "@radix-ui/themes";

import productPlaceholder from "@/assets/product-placeholder.svg";
import { useImage } from "@/shared/lib/infrastructure/media/useImage";
import type { Product, ProductStatus } from "../types";

const STATUS: Record<ProductStatus, { label: string; color: "green" | "yellow" | "red" }> = {
  in_stock: { label: "موجود", color: "green" },
  low_stock: { label: "کم‌موجود", color: "yellow" },
  out_of_stock: { label: "ناموجود", color: "red" },
};

type Props = {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
};

export function ProductPreviewDialog({ product, onOpenChange }: Props) {
  const image = useImage(product?.image_url ?? product?.catalog_product?.image_url) ?? productPlaceholder;
  const status = product ? STATUS[product.status] : STATUS.out_of_stock;

  return (
    <Dialog.Root open={product !== null} onOpenChange={onOpenChange}>
      <Dialog.Content
        dir="rtl"
        maxWidth="620px"
        aria-describedby={undefined}
        className="product-preview-dialog overflow-hidden p-0!"
      >
        <Dialog.Title className="sr-only">پیش‌نمایش محصول</Dialog.Title>
        <div className="relative grid max-h-[calc(100dvh-2rem)] min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <Dialog.Close>
            <IconButton
              aria-label="بستن پیش‌نمایش"
              color="gray"
              variant="solid"
              className="absolute left-3 top-3 z-10"
            >
              <Cross1Icon />
            </IconButton>
          </Dialog.Close>
          <div className="flex min-h-0 items-center justify-center bg-black/5 p-3 sm:p-5">
            <img
              src={image}
              alt={product?.custom_label ?? product?.catalog_product?.name ?? "تصویر محصول"}
              className="max-h-[min(62dvh,34rem)] max-w-full object-contain"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = productPlaceholder;
              }}
            />
          </div>
          {product && (
            <Flex direction="column" gap="3" className="min-w-0 border-t border-foreground/10 p-4 sm:p-5">
              <Flex justify="between" align="center" gap="3" wrap="wrap">
                <Text size="5" weight="bold" className="min-w-0 break-words">
                  {product.custom_label ?? product.catalog_product?.name ?? "محصول بدون نام"}
                </Text>
                <Badge color={status.color}>{status.label}</Badge>
              </Flex>
              <Flex gap="5" wrap="wrap">
                <Text><Text color="gray">تعداد: </Text>{product.quantity.toLocaleString("fa-IR")}</Text>
                <Text><Text color="gray">قیمت: </Text>{product.price.toLocaleString("fa-IR")} تومان</Text>
              </Flex>
            </Flex>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
