import { apiFetch } from "@/shared/api/client";
import type { Industry, CreateIndustry, UpdateIndustry } from "../types";

export function getIndustries(): Promise<Industry[]> {
  return apiFetch("/industries");
}

export function createIndustry(data: CreateIndustry): Promise<Industry> {
  return apiFetch("/industries", {
    method: "POST",
    json: data,
  });
}

export function updateIndustry(payload: {
  id: number;
  data: UpdateIndustry;
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
