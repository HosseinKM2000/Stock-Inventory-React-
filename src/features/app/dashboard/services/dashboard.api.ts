import { apiFetch } from "@/shared/api/client";
import type { DashboardStats } from "../types";

export function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/dashboard/stats");
}
