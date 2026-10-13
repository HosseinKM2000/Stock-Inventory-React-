import { useProducts } from "@/features/app/inventory/mutations/use-products";
import { useBackupStatus } from "@/features/backup/hooks/use-backup-status";
import { useMemo } from "react";
import { notificationService } from "../services/notification.service";

export function useNotifications() {
  const products = useProducts();
  const backupStatus = useBackupStatus();
  const notifications = useMemo(
    () => [
      ...notificationService.deriveBackup(backupStatus),
      ...notificationService.derive(products.data ?? []),
    ],
    [backupStatus, products.data],
  );

  return {
    notifications,
    count: notifications.length,
    isLoading: products.isLoading,
    isError: products.isError,
  };
}
