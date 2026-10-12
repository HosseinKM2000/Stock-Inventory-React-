import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { labelService } from "../services/label.service";
import type { LabelInput } from "../types";

export const labelKeys = { all: ["labels"] as const };

export function useLabels() {
  return useQuery({ queryKey: labelKeys.all, queryFn: labelService.getAll });
}

export function useCreateLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LabelInput) => labelService.create(input),
    onSuccess: () => { void client.invalidateQueries({ queryKey: labelKeys.all }); syncService.schedule(); },
  });
}

export function useUpdateLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => labelService.update(id, { name }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: labelKeys.all }); syncService.schedule(); },
  });
}

export function useDeleteLabel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: labelService.remove,
    onSuccess: () => { void client.invalidateQueries({ queryKey: labelKeys.all }); syncService.schedule(); },
  });
}
