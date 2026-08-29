import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryInput } from "../types";
import { categoryKeys } from "../query/query-keys";
import { categoryService } from "../services/category.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { categoryRefreshService } from "../services/category-refresh.service";

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: categoryService.getAll,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoryService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      void syncService.sync();
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryInput }) =>
      categoryService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      void syncService.sync();
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoryService.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      void syncService.sync();
    },
  });
}

export function useRefreshCategoriesFromServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => categoryRefreshService.refreshFromServer(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
