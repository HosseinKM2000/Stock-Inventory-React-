import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import {
  createCatalogProduct,
  deleteCatalogProduct,
  getCatalogProduct,
  getCatalogProducts,
  updateCatalogProduct,
} from "../api/catalogs.api";

import { catalogProductKeys } from "../query/query-keys";

import type { CatalogProductUpdate } from "../types";

export function useCatalogProducts(params?: {
  search?: string;
  industry_id?: number;
}) {
  return useQuery({
    queryKey: catalogProductKeys.list(
      params?.search,
      params?.industry_id,
    ),

    queryFn: () => getCatalogProducts(params),
  });
}

export function useCatalogProduct(id: number) {
  return useQuery({
    queryKey: catalogProductKeys.detail(id),

    queryFn: () => getCatalogProduct(id),

    enabled: !!id,
  });
}

export function useCreateCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCatalogProduct,

    onSuccess: () => {
      toast.success("محصول کاتالوگ با موفقیت ایجاد شد.");

      queryClient.invalidateQueries({
        queryKey: catalogProductKeys.all,
      });
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

    onSuccess: () => {
      toast.success("محصول کاتالوگ با موفقیت ویرایش شد.");

      queryClient.invalidateQueries({
        queryKey: catalogProductKeys.all,
      });
    },
  });
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogProduct,

    onSuccess: () => {
      toast.success("محصول کاتالوگ حذف شد.");

      queryClient.invalidateQueries({
        queryKey: catalogProductKeys.all,
      });
    },
  });
}