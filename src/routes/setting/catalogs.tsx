import Catalogs from "@/features/setting/components/catalogs";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/catalogs")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Catalogs />;
}
