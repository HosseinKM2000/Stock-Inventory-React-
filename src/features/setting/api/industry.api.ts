import { apiFetch } from "@/shared/api/client";
import type { Industry, IndustryInput } from "../types";
import type { User } from "@/features/auth/types";

export function getIndustries(): Promise<Industry[]> {
  return apiFetch("/industries");
}

export function createIndustry(data: IndustryInput): Promise<Industry> {
  return apiFetch("/industries", {
    method: "POST",
    json: data,
  });
}

export function updateIndustry(payload: {
  id: number;
  data: IndustryInput;
}): Promise<Industry> {
  return apiFetch(`/industries/${payload.id}`, {
    method: "PATCH",
    json: payload.data,
  });
}

export function deleteIndustry(id: number): Promise<void> {
  return apiFetch(`/industries/${id}`, {
    method: "DELETE",
  });
}

export function setIndustry(industry_id: number) {
  return apiFetch<User>("/auth/industry", {
    method: "PATCH",
    json: {
      industry_id,
    },
  });
}
