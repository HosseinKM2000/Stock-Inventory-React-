import { apiFetch } from "@/shared/api/client";
import type { GetProductResponse, Product, ProductInput, ProductListParams } from "../types";

function buildQuery(params: ProductListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.sort) search.set("sort", params.sort);
  if (params.category_id != null)
    search.set("category_id", String(params.category_id));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function toFormData(input: ProductInput): FormData {
  const fd = new FormData();
  const appendField = (key: string, value: unknown) => {
    if (value !== undefined && value !== null) fd.append(key, String(value));
  };

  appendField("name", input.name);
  appendField("description", input.description);
  appendField("unit", input.unit);
  appendField("quantity", input.quantity);
  appendField("price", input.price);
  appendField("low_stock_threshold", input.low_stock_threshold);
  if (input.low_stock_alert !== undefined)
    fd.append("low_stock_alert", String(input.low_stock_alert));
  appendField("category_id", input.category_id);
  if (input.image) fd.append("image", input.image);
  if (input.remove_image) fd.append("remove_image", "true");

  return fd;
}

export function listProducts(params: ProductListParams = {}): Promise<GetProductResponse> {
  return apiFetch<GetProductResponse>(`/inventory${buildQuery(params)}`);
}

export function getProduct(id: number): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
}

export function createProduct(input: ProductInput): Promise<Product> {
  return apiFetch<Product>("/products", {
    method: "POST",
    formData: toFormData(input),
  });
}

export function updateProduct(id: number, input: ProductInput): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: "PATCH",
    formData: toFormData(input),
  });
}

export function deleteProduct(id: number): Promise<void> {
  return apiFetch<void>(`/products/${id}`, { method: "DELETE" });
}
