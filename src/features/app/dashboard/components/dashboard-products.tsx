import { Callout, Flex, Spinner, Text } from "@radix-ui/themes";

import { useDashboardProducts } from "../mutations/use-dashboard";
import { DashboardFilters, type DashboardFilter } from "../types";
import { DashboardProductCard, type DashboardProductVariant } from "./dashboard-product-card";

type DashboardProductsProps = {
  filter: DashboardFilter;
};

const DashboardProducts = ({ filter }: DashboardProductsProps) => {
  const { data, isLoading, isError } = useDashboardProducts(filter);

  const products = data?.products ?? [];
  const variant: DashboardProductVariant = filter === DashboardFilters.ALL ? "total"
    : filter === DashboardFilters.TODAY ? "today"
    : filter === DashboardFilters.INVENTORY_VALUE ? "inventory-value"
    : filter === DashboardFilters.LOW_STOCK || filter === DashboardFilters.URGENT_PURCHASE ? "low"
    : filter === DashboardFilters.OUT_OF_STOCK ? "out"
    : filter === DashboardFilters.NO_PRICE ? "missing-price" : "standard";

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

      {products.map((product) => <DashboardProductCard key={product.id} product={product} variant={variant} />)}
    </Flex>
  );
};

export default DashboardProducts;
