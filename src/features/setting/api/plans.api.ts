import { apiFetch } from "@/shared/api/client";
import type { AdminUser } from "@/features/auth/types";
import type { EntitlementRegistry, StorePlanGrant, SubscriptionPlan, SubscriptionPlanInput } from "../types";

export const listAvailablePlans = () => apiFetch<SubscriptionPlan[]>("/plans");
export const listAdminPlans = () => apiFetch<SubscriptionPlan[]>("/admin/plans");
export const createPlan = (plan: SubscriptionPlanInput) =>
  apiFetch<SubscriptionPlan>("/admin/plans", { method: "POST", json: plan });
export const updatePlan = (id: string, plan: Partial<SubscriptionPlanInput>) => {
  const { id: _pathId, ...payload } = plan;
  void _pathId;
  return apiFetch<SubscriptionPlan>(`/admin/plans/${id}`, { method: "PATCH", json: payload });
};
export const deletePlan = (id: string) =>
  apiFetch<void>(`/admin/plans/${id}`, { method: "DELETE" });
export const listPlanSubscribers = (id: string) =>
  apiFetch<AdminUser[]>(`/admin/plans/${id}/subscribers`);
export const getEntitlementRegistry = () => apiFetch<EntitlementRegistry>("/admin/entitlements/registry");
export const createStorePlanGrant = (value: {
  request_id: string; store_id: number; plan_id: "pro" | "vip"; source: string;
  reason: string; starts_at: string; ends_at: string;
}) => apiFetch<StorePlanGrant>("/admin/grants", { method: "POST", json: value });
