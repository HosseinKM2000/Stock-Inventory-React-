import { resolveAssetUrl } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Badge, Card, Flex, Inset, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { Product, ProductStatus } from "../types";

const STATUS_META: Record<
  ProductStatus,
  { label: string; color: "green" | "yellow" | "red" }
> = {
  in_stock: { label: "موجود", color: "green" },
  low_stock: { label: "کم موجودی", color: "yellow" },
  out_of_stock: { label: "ناموجود", color: "red" },
};

const PLACEHOLDER_IMAGE =
  "https://placehold.co/600x400/1a1a26/8884d8?text=No+Image";

type ProductCardProps = {
  product: Product;
  onDelete: (id: number) => void;
  deleting?: boolean;
};

export function ProductCard({ product, onDelete, deleting }: ProductCardProps) {
  const status = STATUS_META[product.status];

  return (
    <Card size="1">
      <Inset clip="padding-box" side="top" pb="current">
        <img
          src={resolveAssetUrl(product.image_url) ?? PLACEHOLDER_IMAGE}
          alt={product.name}
          style={{
            height: 140,
            width: "100%",
            display: "block",
            objectFit: "cover",
            backgroundColor: "var(--gray-5)",
          }}
        />
      </Inset>
      <Flex
        align={"center"}
        justify={"between"}
        className="w-full text-left flex-wrap"
      >
        <Badge color={status.color}>{status.label}</Badge>
      </Flex>
      <Flex direction={"column"} gap="1" mt={"3"} align="start">
        <Text as="div" size="2" weight="bold">
          {product.name}
        </Text>
        <Text as="div" size="2" color="gray" className="line-clamp-1">
          {product.description || "بدون توضیحات"}
        </Text>
      </Flex>
      <Flex mt={"5"} justify={"between"} align={"center"}>
        <Badge variant="solid" radius="full" color="indigo">
          {product.price.toLocaleString("fa-IR")} تومان
        </Badge>
        <Flex gapX={"2"} align={"center"}>
          <Badge color="gray" variant="solid">
            {product.quantity.toLocaleString("fa-IR")}
            {product.unit ? ` ${product.unit}` : ""}
          </Badge>
        </Flex>
      </Flex>
      <Flex mt={"4"} gapX={"2"} justify={"end"}>
        <Link to="/product/edit" search={{ id: product.id }}>
          <Button size={"2"} color="amber" variant="surface">
            <Pencil1Icon width={"16"} height={"16"} />
            ویرایش
          </Button>
        </Link>
        <Button
          size={"2"}
          color="red"
          variant="surface"
          loading={deleting}
          onClick={() => onDelete(product.id)}
        >
          <TrashIcon width={"16"} height={"16"} />
        </Button>
      </Flex>
    </Card>
  );
}
