import { CatalogPreferences } from "@/features/setting/components/catalog-preferences";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/catalog")({ component: CatalogPreferences });
