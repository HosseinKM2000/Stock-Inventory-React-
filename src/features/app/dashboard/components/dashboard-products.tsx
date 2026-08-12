import { ProductCard } from "@/features/app/inventory/components/inventory-card";
import { useDeleteProduct } from "@/features/app/inventory/mutations/use-products";
import { Box, Callout, Flex, Spinner, Text } from "@radix-ui/themes";

import { useDashboardProducts } from "../mutations/use-dashboard";
import type { DashboardFilter } from "../types";

type DashboardProductsProps = {
  filter: DashboardFilter;
};

const DashboardProducts = ({ filter }: DashboardProductsProps) => {
  const { data, isLoading, isError } = useDashboardProducts(filter);

  const deleteProduct = useDeleteProduct();

  const products = data?.products ?? [];

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
            onDelete={(id) => deleteProduct.mutate(id)}
            deleting={
              deleteProduct.isPending && deleteProduct.variables === product.id
            }
          />
        </Box>
      ))}
    </Flex>
  );
};

export default DashboardProducts;
