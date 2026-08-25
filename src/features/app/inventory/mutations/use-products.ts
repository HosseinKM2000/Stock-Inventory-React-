import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/app/dashboard/query/dashboard-query-keys";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";

import { productKeys } from "../query/query-keys";

import { inventoryService } from "../services/inventory-service";

import type { Product, ProductInput, ProductListParams } from "../types";

function useInvalidateProducts() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: productKeys.all });

    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

    if (networkService.isOnline()) {
      void syncService.sync();
    } else {
      void syncService.refreshPending();
    }
  };
}

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),

    queryFn: () => inventoryService.getAll({ ...params, include_hidden: false }),

    staleTime: 0,
  });
}

export function useProduct(id: number | undefined) {
  return useQuery<Product | undefined>({
    queryKey: productKeys.detail(id ?? -1),

    queryFn: () => inventoryService.get(id as number),

    enabled: id !== undefined,
  });
}

export function useCreateProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: (input: Product) => inventoryService.create(input),

    onSuccess() {
      invalidate();
    },
  });
}

export function useUpdateProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProductInput }) =>
      inventoryService.update(id, input),

    onSuccess() {
      invalidate();
    },
  });
}

export function useAdjustProductQuantity() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: ({ id, delta }: { id: number; delta: number }) =>
      inventoryService.adjustQuantity(id, delta),

    onSuccess() {
      invalidate();
    },
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateProducts();

  return useMutation({
    mutationFn: (id: number) => inventoryService.remove(id),

    onSuccess() {
      invalidate();
    },
  });
}
