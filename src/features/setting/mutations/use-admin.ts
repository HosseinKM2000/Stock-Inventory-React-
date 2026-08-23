import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeys, planKeys } from "../query/query-keys";
import { createPlan, listAdminPlans, listAvailablePlans, listPlanSubscribers, updatePlan } from "../api/plans.api";
import { deleteUser, listUsers, setUserActive, setUserRole, setUserSubscription } from "../api/users.api";
import type { SubscriptionPlanInput } from "../types";

export const useAdminUsers = () => useQuery({ queryKey: adminKeys.users, queryFn: listUsers });
export const useAdminPlans = () => useQuery({ queryKey: adminKeys.plans, queryFn: listAdminPlans });
export const useAvailablePlans = () => useQuery({ queryKey: planKeys.all, queryFn: listAvailablePlans });
export const usePlanSubscribers = (planId: string, enabled: boolean) => useQuery({
  queryKey: adminKeys.subscribers(planId),
  queryFn: () => listPlanSubscribers(planId),
  enabled,
});

function useUserMutation<T>(mutationFn: (value: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export const useSetUserActive = () => useUserMutation(({ id, active }: { id: number; active: boolean }) => setUserActive(id, active));
export const useSetUserRole = () => useUserMutation(({ id, role }: { id: number; role: "USER" | "ADMIN" }) => setUserRole(id, role));
export const useSetUserSubscription = () => useUserMutation(({ id, plan }: { id: number; plan: string }) => setUserSubscription(id, plan));
export const useDeleteUser = () => useUserMutation((id: number) => deleteUser(id));

export function useCreatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: adminKeys.plans }),
      client.invalidateQueries({ queryKey: planKeys.all }),
    ]),
  });
}

export function useUpdatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: Partial<SubscriptionPlanInput> }) => updatePlan(id, plan),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: adminKeys.plans }),
      client.invalidateQueries({ queryKey: planKeys.all }),
      client.invalidateQueries({ queryKey: planKeys.current }),
    ]),
  });
}
