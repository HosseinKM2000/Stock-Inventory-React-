import ProductsList from "@/features/app/products/components/products-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/product/list")({
  component: ProductsList,
});
