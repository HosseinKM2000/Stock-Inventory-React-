import AddProductForm from "@/features/app/inventory/components/add-inventory-form";
import { createFileRoute } from "@tanstack/react-router";
import { CapabilityGuard } from "@/shared/access/capability-guard";

export const Route = createFileRoute("/(app)/inventory/add")({
  component: () => <CapabilityGuard capability="inventory.write"><AddProductForm /></CapabilityGuard>,
});
