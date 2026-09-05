import ProductSettings from "@/features/setting/components/products";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/products")({
  component: ProductSettings,
});
