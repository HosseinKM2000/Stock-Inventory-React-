import EditProductForm from "@/features/app/products/components/edit-product-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/product/edit")({
  component: EditProductForm,
});
