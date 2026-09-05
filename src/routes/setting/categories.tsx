import CategoriesCards from "@/features/setting/components/categories";
import { createFileRoute } from "@tanstack/react-router";
import { CapabilityGuard } from "@/shared/access/capability-guard";

export const Route = createFileRoute("/setting/categories")({
  component: RouteComponent,
});

function RouteComponent() {
  return <CapabilityGuard capability="categories.write"><CategoriesCards /></CapabilityGuard>;
}
