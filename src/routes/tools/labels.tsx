import LabelsPage from "@/features/setting/components/labels";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/labels")({ component: LabelsPage });
