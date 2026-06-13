import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/products")({
  component: ProductsLayout,
});

function ProductsLayout() {
  return <Outlet />;
}
