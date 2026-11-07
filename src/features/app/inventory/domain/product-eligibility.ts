import type { Product } from "../types";

export type ProductEligibilityOptions = {
  includeHidden?: boolean;
  hideCatalogProducts?: boolean;
};

export function resolvedProductName(product: Product): string | null {
  const value = product.custom_label?.trim() || product.catalog_product?.name?.trim();
  return value || null;
}

/** Shared read-model rule; it never deletes or mutates the underlying record. */
export function isProductEligible(
  product: Product,
  options: ProductEligibilityOptions = {},
): boolean {
  if (product.deleted_at) return false;
  if (!options.includeHidden && product.is_hidden) return false;
  if (options.hideCatalogProducts && product.is_catalog_backed) return false;
  if (product.is_catalog_backed) {
    if (!product.catalog_product) return false;
    if (product.catalog_product.is_active === false) return false;
  }
  return resolvedProductName(product) !== null;
}
