import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { labelService } from "../services/label.service";
import type { LabelInput } from "../types";
import { accessState } from "@/shared/access/access-state";
import { productKeys } from "@/features/app/inventory/query/query-keys";

export const labelKeys = {
  all: ["labels"] as const,
  list: (userId: number | undefined) => ["labels", "list", userId] as const,
};

export function useLabels() {
  const userId = accessState.user()?.id;
  return useQuery({ queryKey: labelKeys.list(userId), queryFn: labelService.getAll, enabled: userId !== undefined });
}

export function useCreateLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LabelInput) => labelService.create(input),
    onSuccess: () => {
      void Promise.all([
        client.invalidateQueries({ queryKey: labelKeys.all }),
        client.invalidateQueries({ queryKey: productKeys.all }),
      ]);
      syncService.schedule();
    },
  });
}

export function useUpdateLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => labelService.update(id, { name }),
    onSuccess: () => {
      void Promise.all([
        client.invalidateQueries({ queryKey: labelKeys.all }),
        client.invalidateQueries({ queryKey: productKeys.all }),
      ]);
      syncService.schedule();
    },
  });
}

export function useDeleteLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: labelService.remove,
    onSuccess: () => {
      void Promise.all([
        client.invalidateQueries({ queryKey: labelKeys.all }),
        client.invalidateQueries({ queryKey: productKeys.all }),
      ]);
      syncService.schedule();
    },
  });
}
