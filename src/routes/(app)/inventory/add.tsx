import AddProductForm from "@/features/app/inventory/components/add-inventory-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/inventory/add")({
  component: AddProductForm,
});
