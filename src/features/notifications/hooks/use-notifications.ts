import { useProducts } from "@/features/app/inventory/mutations/use-products";
import { useMemo } from "react";
import { notificationService } from "../services/notification.service";

export function useNotifications() {
  const products = useProducts();
  const notifications = useMemo(
    () => notificationService.derive(products.data ?? []),
    [products.data],
  );

  return {
    notifications,
    count: notifications.length,
    isLoading: products.isLoading,
    isError: products.isError,
  };
}
