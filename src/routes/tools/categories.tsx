import CategoriesCards from "@/features/setting/components/categories";
import { CapabilityGuard } from "@/shared/access/capability-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/categories")({
  component: () => <CapabilityGuard capability="categories.write"><CategoriesCards /></CapabilityGuard>,
});
