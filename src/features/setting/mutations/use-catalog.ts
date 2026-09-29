import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";
import { dashboardKeys } from "@/features/app/dashboard/query/dashboard-query-keys";
import { productKeys } from "@/features/app/inventory/query/query-keys";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";

import {
  archiveCatalogProduct,
  createCatalogProduct,
  deleteCatalogProduct,
  getArchivedCatalogProducts,
  getCatalogProduct,
  getCatalogProducts,
  restoreCatalogProduct,
  updateCatalogProduct,
} from "../api/catalogs.api";

import { catalogProductKeys } from "../query/query-keys";

import type {
  CatalogProductListParams,
  CatalogProductUpdate,
} from "../types";

export function useCatalogProducts(
  params?: CatalogProductListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: catalogProductKeys.list(params),

    queryFn: () => getCatalogProducts(params),

    enabled,

    // Catalog membership is server-authoritative. Refresh on every visit so
    // records cached before an archive or backend migration cannot reappear.
    refetchOnMount: "always",
  });
}

export function useArchivedCatalogProducts(
  params?: CatalogProductListParams,
  enabled = true,
) {
  return useQuery({
    queryKey: catalogProductKeys.archivedList(params),
    queryFn: () => getArchivedCatalogProducts(params),
    enabled,
    refetchOnMount: "always",
  });
}

export function useCatalogProduct(id: number, enabled = true) {
  return useQuery({
    queryKey: catalogProductKeys.detail(id),

    queryFn: () => getCatalogProduct(id),

    enabled: !!id && enabled,
  });
}

export function useCreateCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCatalogProduct,

    onSuccess: async () => {
      toast.success("محصول کاتالوگ با موفقیت ایجاد شد.");
      await syncService.sync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}

export function useUpdateCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: CatalogProductUpdate;
    }) => updateCatalogProduct(id, data),

    onSuccess: async (product) => {
      toast.success("محصول کاتالوگ با موفقیت ویرایش شد.");

      queryClient.setQueryData(catalogProductKeys.detail(product.id), product);
      await syncService.sync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogProduct,

    onSuccess: async (_, id) => {
      toast.success("محصول و تمام نسخه‌های موجود در فهرست کاربران حذف شدند.");

      queryClient.removeQueries({ queryKey: catalogProductKeys.detail(id) });
      await syncService.sync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },

    onError: () => {
      toast.error("حذف دائمی محصول کاتالوگ ناموفق بود.");
      queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() });
    },
  });
}

export function useArchiveCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveCatalogProduct,
    onSuccess: async (product) => {
      toast.success("محصول بایگانی شد؛ محصولات موجود کاربران حفظ شده‌اند.");
      queryClient.removeQueries({ queryKey: catalogProductKeys.detail(product.id) });
      await queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() });
    },
    onError: () => toast.error("بایگانی محصول کاتالوگ ناموفق بود."),
  });
}

export function useRestoreCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCatalogProduct,
    onSuccess: async (product) => {
      toast.success("محصول دوباره به کاتالوگ فعال بازگردانده شد.");
      await syncService.sync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
      queryClient.setQueryData(catalogProductKeys.detail(product.id), product);
    },
    onError: () => toast.error("بازگردانی محصول کاتالوگ ناموفق بود."),
  });
}
