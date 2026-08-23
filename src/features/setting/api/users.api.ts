import { apiFetch } from "@/shared/api/client";
import type { User } from "@/features/auth/types";

export const listUsers = () => apiFetch<User[]>("/admin/users");
export const setUserActive = (id: number, is_active: boolean) =>
  apiFetch<User>(`/admin/users/${id}/state`, { method: "PATCH", json: { is_active } });
