import { BackupSettings } from "@/features/backup/components/backup-settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/backup")({
  component: BackupSettings,
});
