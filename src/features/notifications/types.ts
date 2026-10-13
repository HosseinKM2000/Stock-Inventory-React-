export type NotificationSeverity = "critical" | "warning";
export type InventoryNotificationKind = "out_of_stock" | "urgent_purchase" | "low_stock";

export type InventoryNotification = {
  id: string;
  productId: number;
  productName: string;
  kind: InventoryNotificationKind;
  severity: NotificationSeverity;
  title: string;
  description: string;
  context: string;
};

export type BackupNotificationKind =
  | "backup_not_configured"
  | "backup_permission_required"
  | "backup_failed"
  | "backup_manual_required";

export type BackupNotification = {
  id: string;
  kind: BackupNotificationKind;
  severity: NotificationSeverity;
  title: string;
  description: string;
  context: string;
  route: "/setting/backup";
};

export type AppNotification = InventoryNotification | BackupNotification;
