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
