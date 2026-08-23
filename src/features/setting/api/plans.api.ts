import { apiFetch } from "@/shared/api/client";
import type { AdminUser } from "@/features/auth/types";
import type { SubscriptionPlan, SubscriptionPlanInput } from "../types";

export const listAvailablePlans = () => apiFetch<SubscriptionPlan[]>("/plans");
export const listAdminPlans = () => apiFetch<SubscriptionPlan[]>("/admin/plans");
export const createPlan = (plan: SubscriptionPlanInput) =>
  apiFetch<SubscriptionPlan>("/admin/plans", { method: "POST", json: plan });
export const updatePlan = (id: string, plan: Partial<SubscriptionPlanInput>) =>
  apiFetch<SubscriptionPlan>(`/admin/plans/${id}`, { method: "PATCH", json: plan });
export const listPlanSubscribers = (id: string) =>
  apiFetch<AdminUser[]>(`/admin/plans/${id}/subscribers`);
