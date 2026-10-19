import ProductsList from "@/features/app/inventory/components/inventory-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/inventory/list")({
  component: ProductsList,
});
