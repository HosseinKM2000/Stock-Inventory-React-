import Catalogs from "@/features/setting/components/catalogs";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/catalogs")({
  component: () => <OnlineGuard><Catalogs /></OnlineGuard>,
});
