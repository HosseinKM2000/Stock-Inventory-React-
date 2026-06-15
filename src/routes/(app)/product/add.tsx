import AddProductForm from "@/features/app/products/components/add-product-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/product/add")({
  component: AddProductForm,
});
