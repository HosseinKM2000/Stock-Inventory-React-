import { dashboardKeys } from "@/features/app/dashboard/query/dashboard-query-keys";
import { productKeys } from "@/features/app/inventory/query/query-keys";
import { inventoryRefreshService } from "@/features/app/inventory/services/inventory-refresh.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useRefreshProductsFromServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => inventoryRefreshService.refreshFromServer(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      toast.success("محصولات با آخرین اطلاعات سرور به‌روزرسانی شدند.");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "به‌روزرسانی محصولات از سرور ناموفق بود.",
      );
    },
  });
}
