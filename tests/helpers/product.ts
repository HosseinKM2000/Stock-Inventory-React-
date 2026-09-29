import type { Product } from "@/features/app/inventory/types";

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    catalog_product_id: 1,
    is_catalog_backed: false,
    category_id: null,
    quantity: 10,
    price: 100,
    custom_label: "Test product",
    note: null,
    low_stock_threshold: 3,
    low_stock_alert: true,
    is_hidden: false,
    image_url: null,
    deleted_at: null,
    status: "in_stock",
    created_at: "2026-09-02T08:00:00.000Z",
    updated_at: "2026-09-02T08:00:00.000Z",
    catalog_product: {
      id: 1,
      industry_id: 1,
      name: "Test product",
      description: null,
      brand: null,
      image_url: null,
      is_packaged: false,
      pack_size: null,
      created_at: "2026-09-02T08:00:00.000Z",
    },
    ...overrides,
  };
}
