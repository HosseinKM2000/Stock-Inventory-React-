import { apiFetch } from "@/shared/api/client";
import type { AdminUser } from "@/features/auth/types";

export const listUsers = () => apiFetch<AdminUser[]>("/admin/users");
export const setUserActive = (id: number, is_active: boolean) =>
  apiFetch<AdminUser>(`/admin/users/${id}/state`, { method: "PATCH", json: { is_active } });

export const setUserRole = (id: number, role: "USER" | "ADMIN") =>
  apiFetch<AdminUser>(`/admin/users/${id}/role`, { method: "PATCH", json: { role } });

export const setUserSubscription = (id: number, plan: string) =>
  apiFetch<AdminUser>(`/admin/users/${id}/subscription`, { method: "PATCH", json: { plan } });

export const deleteUser = (id: number) =>
  apiFetch<void>(`/admin/users/${id}`, { method: "DELETE" });
