import { apiFetch } from "@/shared/api/client";
import type { Category, CategoryInput } from "../types";

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}

export function createCategory(payload: CategoryInput): Promise<Category> {
  return apiFetch<Category>("/categories", { method: "POST", json: payload });
}

export function updateCategory(
  id: number,
  payload: CategoryInput,
): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, {
    method: "PATCH",
    json: payload,
  });
}

export function deleteCategory(id: number): Promise<void> {
  return apiFetch<void>(`/categories/${id}`, { method: "DELETE" });
}
