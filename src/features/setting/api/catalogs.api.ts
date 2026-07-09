import { apiFetch } from "@/shared/api/client";
import type {
  CatalogProduct,
  CatalogProductInput,
  CatalogProductUpdate,
} from "../types";

export function getCatalogProducts(params?: {
  search?: string;
  industry_id?: number;
}) {
  const query = new URLSearchParams();

  if (params?.search) query.set("search", params.search);

  if (params?.industry_id) query.set("industry_id", String(params.industry_id));

  return apiFetch<CatalogProduct[]>(`/catalog-products?${query.toString()}`);
}

export function getCatalogProduct(id: number) {
  return apiFetch<CatalogProduct>(`/catalog-products/${id}`);
}

export function createCatalogProduct(data: CatalogProductInput) {
  return apiFetch<CatalogProduct>("/catalog-products", {
    method: "POST",
    json: data,
  });
}

export function updateCatalogProduct(id: number, data: CatalogProductUpdate) {
  return apiFetch<CatalogProduct>(`/catalog-products/${id}`, {
    method: "PATCH",
    json: data,
  });
}

export function deleteCatalogProduct(id: number) {
  return apiFetch<void>(`/catalog-products/${id}`, {
    method: "DELETE",
  });
}
