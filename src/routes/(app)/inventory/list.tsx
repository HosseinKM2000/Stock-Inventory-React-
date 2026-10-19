import ProductsList from "@/features/app/inventory/components/inventory-list";
import { createFileRoute } from "@tanstack/react-router";
import { accessState } from "@/shared/access/access-state";
import { Box, Callout } from "@radix-ui/themes";

export const Route = createFileRoute("/(app)/inventory/list")({
  component: ProductsRoute,
});

function ProductsRoute() {
  if (!accessState.hasStorePermission("products.view")) {
    return (
      <Box dir="rtl" className="mx-auto w-full max-w-3xl pt-8">
        <Callout.Root color="orange" role="status">
          <Callout.Text>شما اجازه مشاهده محصولات این مجموعه را ندارید. برای تغییر دسترسی با مالک مجموعه تماس بگیرید.</Callout.Text>
        </Callout.Root>
      </Box>
    );
  }
  return <ProductsList />;
}
