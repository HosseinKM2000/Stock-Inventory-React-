import { ExcelImport } from "@/features/app/inventory/components/excel-import";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/import")({ component: ExcelImport });
