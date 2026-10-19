import EditProductForm from "@/features/app/products/components/edit-product-form";
import { createFileRoute } from "@tanstack/react-router";

type ProductEditSearch = {
  id: number;
};

export const Route = createFileRoute("/(app)/product/edit")({
  validateSearch: (search: Record<string, unknown>): ProductEditSearch => ({
    id: Number(search.id),
  }),
  component: EditRoute,
});

function EditRoute() {
  const { id } = Route.useSearch();
  return <EditProductForm id={id} />;
}
