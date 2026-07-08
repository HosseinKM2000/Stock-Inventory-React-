import { apiFetch } from "@/shared/api/client";
import type { Industry } from "../types";

export function setIndustry(payload: Industry): Promise<Industry> {
  return apiFetch<Industry>("/auth/me", {
    method: "PATCH",
    json: payload,
  });
}
