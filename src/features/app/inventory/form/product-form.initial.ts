import type { Product } from "../types";

function generateLocalId() {
  return Date.now();
}

export function createProductInitialValues(initial?: Product) {
  const now = new Date().toISOString();

  return {
    id: initial?.id ?? generateLocalId(),

    quantity: initial?.quantity ?? 0,

    price: initial?.price ?? 0,

    custom_label: initial?.custom_label ?? "",

    note: initial?.note ?? null,

    low_stock_threshold: initial?.low_stock_threshold ?? 0,

    low_stock_alert: initial?.low_stock_alert ?? false,

    is_hidden: initial?.is_hidden ?? false,

    image_url: initial?.image_url ?? null,

    deleted_at: initial?.deleted_at ?? null,

    status: initial?.status ?? "out_of_stock",

    created_at: initial?.created_at ?? now,

    updated_at: initial?.updated_at ?? now,

    catalog_product: {
      id: initial?.catalog_product?.id ?? 0,

      industry_id: initial?.catalog_product?.industry_id ?? 0,

      name: initial?.catalog_product?.name ?? "",

      description: initial?.catalog_product?.description ?? null,

      brand: initial?.catalog_product?.brand ?? null,

      image_url: initial?.catalog_product?.image_url ?? null,

      created_at: initial?.catalog_product?.created_at ?? now,
    },

    image: null,

    remove_image: false,
  };
}
