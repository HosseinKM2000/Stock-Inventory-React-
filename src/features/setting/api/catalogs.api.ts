import { apiFetch } from "@/shared/api/client";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import type {
  CatalogProduct,
  CatalogProductInput,
  CatalogProductListParams,
  CatalogProductUpdate,
} from "../types";

function requireOnline() {
  if (networkService.isOffline()) {
    throw new Error("مدیریت کاتالوگ به اتصال اینترنت نیاز دارد.");
  }
}

export function getCatalogProducts(params?: CatalogProductListParams) {
  requireOnline();
  const query = new URLSearchParams();

  if (params?.search) query.set("search", params.search);

  if (params?.industry_id) query.set("industry_id", String(params.industry_id));

  const queryString = query.toString();
  return apiFetch<CatalogProduct[]>(
    `/catalog-products${queryString ? `?${queryString}` : ""}`,
  );
}

export function getCatalogProduct(id: number) {
  requireOnline();
  return apiFetch<CatalogProduct>(`/catalog-products/${id}`);
}

export function createCatalogProduct(data: CatalogProductInput) {
  requireOnline();
  return apiFetch<CatalogProduct>("/catalog-products", {
    method: "POST",
    json: data,
  });
}

export function updateCatalogProduct(id: number, data: CatalogProductUpdate) {
  requireOnline();
  return apiFetch<CatalogProduct>(`/catalog-products/${id}`, {
    method: "PATCH",
    json: data,
  });
}

export function deleteCatalogProduct(id: number) {
  requireOnline();
  return apiFetch<void>(`/catalog-products/${id}`, {
    method: "DELETE",
  });
}
