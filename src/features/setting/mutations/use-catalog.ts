import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";
import { ApiError } from "@/shared/api/api-error";

import {
  createCatalogProduct,
  deleteCatalogProduct,
  getCatalogProduct,
  getCatalogProducts,
  updateCatalogProduct,
} from "../api/catalogs.api";

import { catalogProductKeys } from "../query/query-keys";

import type {
  CatalogProductListParams,
  CatalogProductUpdate,
} from "../types";

export function useCatalogProducts(params?: CatalogProductListParams) {
  return useQuery({
    queryKey: catalogProductKeys.list(params),

    queryFn: () => getCatalogProducts(params),
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

    onSuccess: () => {
      toast.success("محصول کاتالوگ با موفقیت ایجاد شد.");

      queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() });
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

    onSuccess: (product) => {
      toast.success("محصول کاتالوگ با موفقیت ویرایش شد.");

      queryClient.setQueryData(catalogProductKeys.detail(product.id), product);
      queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() });
    },
  });
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogProduct,

    onSuccess: (_, id) => {
      toast.success("محصول از کاتالوگ فعال بایگانی شد؛ موجودی کاربران حفظ شده است.");

      queryClient.removeQueries({ queryKey: catalogProductKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: catalogProductKeys.lists() });
    },

    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.message === "CATALOG_PRODUCT_NOT_FOUND"
          ? "محصول کاتالوگ پیدا نشد."
          : "بایگانی محصول کاتالوگ ناموفق بود.",
      );
    },
  });
}
