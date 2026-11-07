import { useProducts } from "@/features/app/inventory/mutations/use-products";
import { useBackupStatus } from "@/features/backup/hooks/use-backup-status";
import { useMemo } from "react";
import { notificationService } from "../services/notification.service";
import { useAppUpdate } from "@/features/app-update/hooks/use-app-update";

export function useNotifications() {
  const products = useProducts();
  const backupStatus = useBackupStatus();
  const appUpdate = useAppUpdate();
  const notifications = useMemo(
    () => [
      ...notificationService.deriveBackup(backupStatus),
      ...notificationService.deriveUpdate(appUpdate),
      ...notificationService.derive(products.data ?? []),
    ],
    [appUpdate, backupStatus, products.data],
  );

  return {
    notifications,
    count: notifications.length,
    isLoading: products.isLoading,
    isError: products.isError,
  };
}
