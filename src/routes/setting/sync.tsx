import { SyncStatusPage } from "@/features/setting/components/sync/sync-status-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/sync")({
  component: SyncStatusPage,
});
