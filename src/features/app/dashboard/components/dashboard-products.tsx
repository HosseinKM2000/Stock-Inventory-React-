import { ProductCard } from "@/features/app/inventory/components/inventory-card";
import { useDeleteProduct } from "@/features/app/inventory/mutations/use-products";
import { Box, Callout, Flex, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { toast } from "sonner";

import { useDashboardProducts } from "../mutations/use-dashboard";
import type { DashboardFilter } from "../types";
import type { Product } from "@/features/app/inventory/types";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

type DashboardProductsProps = {
  filter: DashboardFilter;
};

const DashboardProducts = ({ filter }: DashboardProductsProps) => {
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { data, isLoading, isError } = useDashboardProducts(filter);

  const deleteProduct = useDeleteProduct();

  const products = data?.products ?? [];

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
    <Flex direction="column" gap="4" className="p-4" dir="rtl">
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

      {products.map((product) => (
        <Box key={product.id}>
          <ProductCard
            product={product}
            onDelete={() => setProductToDelete(product)}
            deleting={
              deleteProduct.isPending && deleteProduct.variables === product.id
            }
          />
        </Box>
      ))}

      <ConfirmDialog
        open={productToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProductToDelete(null);
        }}
        title="محصول حذف شود؟"
        description={
          productToDelete
            ? `آیا از حذف «${productToDelete.custom_label ?? productToDelete.catalog_product?.name ?? "این محصول"}» مطمئن هستید؟ این تغییر پس از همگام‌سازی روی سرور نیز اعمال می‌شود.`
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
