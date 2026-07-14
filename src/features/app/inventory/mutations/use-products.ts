import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { productKeys } from "../query/query-keys";

import { inventoryService } from "../services/inventory-service";

import type { Product, ProductInput, ProductListParams } from "../types";

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: productKeys.list(params),

    queryFn: () => inventoryService.getAll(params),

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Product) => inventoryService.create(input),

    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: productKeys.all,
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProductInput }) =>
      inventoryService.update(id, input),

    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: productKeys.all,
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => inventoryService.remove(id),

    onSuccess() {
      queryClient.invalidateQueries({
        queryKey: productKeys.all,
      });
    },
  });
}
