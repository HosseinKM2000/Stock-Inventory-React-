import { ScannerPage } from "@/features/barcode/components/scanner-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/scanner")({ component: ScannerPage });
