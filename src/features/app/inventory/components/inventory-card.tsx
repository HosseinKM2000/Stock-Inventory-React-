import { resolveAssetUrl } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

import type { Product, ProductStatus } from "../types";

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

const PLACEHOLDER = "https://placehold.co/600x400/e5e7eb/6b7280?text=No+Image";

type Props = {
  product: Product;
  deleting?: boolean;
  onDelete: (id: number) => void;
};

export function ProductCard({ product, deleting, onDelete }: Props) {
  const status = STATUS_META[product.status];

  const image = resolveAssetUrl(product.image_url) ?? PLACEHOLDER;

  return (
    <Card
      size="2"
      className="
        h-47
        overflow-hidden
        transition-all
        duration-200
      "
    >
      <Flex className="h-full">
        {/* Image */}

        <div className="w-36 shrink-0">
          <img
            src={image}
            alt={product.catalog_product.name}
            className="
              w-full
              h-full
              object-cover
            "
          />
        </div>

        {/* Content */}

        <Flex direction="column" justify="between" className="flex-1 p-4 ">
          {/* Header */}

          <Flex justify="between" align="start">
            <Flex direction="column" gap="1">
              <Text weight="bold" size="3">
                {product.custom_label ?? product.catalog_product.name}
              </Text>

              {product.catalog_product.brand && (
                <Text size="1" color="gray">
                  {product.catalog_product.brand}
                </Text>
              )}
            </Flex>

            <Badge color={status.color}>{status.label}</Badge>
          </Flex>

          {/* Description */}

          <Text size="2" color="gray" className="line-clamp-2">
            {product.note ??
              product.catalog_product.description ??
              "بدون توضیح"}
          </Text>
          <Flex align={"end"} justify={"between"}>
            {/* Price & Quantity */}
            <Flex
              width={"fit-content"}
              gapX={"3"}
              justify="between"
              align="center"
            >
              <Badge color="indigo" size={"3"} radius="full">
                100000 {product.price.toLocaleString("fa-IR")} تومان
              </Badge>

              <Badge variant="soft" color="gray" size={"3"}>
                تعداد: {product.quantity.toLocaleString("fa-IR")}
              </Badge>
            </Flex>

            {/* Actions */}

            <Flex gap="2" justify="end">
              <Link to="/inventory/edit" search={{ id: product.id }}>
                <Button size="2" variant="soft" color="amber">
                  <Pencil1Icon />
                  ویرایش
                </Button>
              </Link>

              <Button
                size="2"
                color="red"
                variant="soft"
                loading={deleting}
                onClick={() => onDelete(product.id)}
              >
                <TrashIcon width={23} height={23} />
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}
