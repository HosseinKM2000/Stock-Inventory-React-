import CategoriesCards from "@/features/setting/components/categories";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/categories")({
  component: RouteComponent,
});

function RouteComponent() {
  return <CategoriesCards />;
}
