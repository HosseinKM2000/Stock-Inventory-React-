import ProductList from "@/features/app/products/components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/product/list")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ProductList />;
}
