import { ProductCard } from "@/features/app/inventory/components/inventory-card";
import { useDeleteProduct } from "@/features/app/inventory/mutations/use-products";
import { Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";
import type { Product } from "@/features/app/inventory/types";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

import { useDashboardProducts } from "../mutations/use-dashboard";
import { DashboardFilters, type DashboardFilter } from "../types";

type DashboardProductsProps = {
  filter: DashboardFilter;
};

const DashboardProducts = ({ filter }: DashboardProductsProps) => {
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { data, isLoading, isError } = useDashboardProducts(filter);
  const deleteProduct = useDeleteProduct();

  const products = data?.products ?? [];
  const minimal =
    filter === DashboardFilters.ALL ||
    filter === DashboardFilters.TODAY ||
    filter === DashboardFilters.INVENTORY_VALUE;

  const confirmDelete = () => {
    if (!productToDelete) return;
    const name = productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "محصول";
    deleteProduct.mutate(productToDelete.id, {
      onSuccess: () => {
        setProductToDelete(null);
        toast.success(`«${name}» حذف شد.`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "حذف محصول ناموفق بود");
      },
    });
  };

  return (
    <Flex direction="column" gap="4" className="app-responsive-page p-4" dir="rtl">
      <Text size="6" weight="bold">
        {data?.title ?? ""}
      </Text>

      {isLoading && (
        <Flex justify="center" align="center" py="9">
          <Spinner />
        </Flex>
      )}

      {isError && (
        <Callout.Root color="red">
          <Callout.Text>خطا در دریافت محصولات</Callout.Text>
        </Callout.Root>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <Flex justify="center" align="center" py="9">
          <Text color="gray">محصولی یافت نشد</Text>
        </Flex>
      )}

      {products.map((product) => {
        const name = product.custom_label ?? product.catalog_product?.name ?? "محصول بدون نام";

        if (minimal) {
          return (
            <Card key={product.id} size="1" className="min-w-0">
              <Text as="div" weight="medium" className="break-words">{name}</Text>
              {filter === DashboardFilters.TODAY && (
                <Flex gap="4" mt="1" wrap="wrap">
                  <Text size="1" color="gray">قیمت: {product.price.toLocaleString("fa-IR")} تومان</Text>
                  <Text size="1" color="gray">تعداد: {product.quantity.toLocaleString("fa-IR")}</Text>
                </Flex>
              )}
              {filter === DashboardFilters.INVENTORY_VALUE && (
                <Flex direction="column" gap="1" mt="1">
                  <Text size="1" color="gray">قیمت واحد: {product.price.toLocaleString("fa-IR")} تومان</Text>
                  <Text size="1" color="gray">تعداد: {product.quantity.toLocaleString("fa-IR")}</Text>
                  <Text size="2" weight="bold" color="green">
                    ارزش موجودی: {(product.price * product.quantity).toLocaleString("fa-IR")} تومان
                  </Text>
                </Flex>
              )}
            </Card>
          );
        }

        return (
          <Box key={product.id}>
            <ProductCard
              product={product}
              showQuickStock={false}
              onDelete={() => setProductToDelete(product)}
              deleting={deleteProduct.isPending && deleteProduct.variables === product.id}
            />
          </Box>
        );
      })}

      <ConfirmDialog
        open={productToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        title="محصول حذف شود؟"
        description={
          productToDelete
            ? `آیا از حذف «${productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "این محصول"}» مطمئن هستید؟`
            : ""
        }
        confirmLabel="حذف محصول"
        cancelLabel="لغو"
        variant="danger"
        loading={deleteProduct.isPending}
        onConfirm={confirmDelete}
      />
    </Flex>
  );
};

export default DashboardProducts;
