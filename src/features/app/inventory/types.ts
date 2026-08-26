export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";

export type CatalogProduct = {
  id: number;

  industry_id: number;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;

  created_at: string;
};

export type Product = {
  id: number;

  local_user_id?: number;

  catalog_product_id: number;

  is_catalog_backed: boolean;

  category_id: number | null;

  version?: number;

  quantity: number;

  price: number;

  custom_label: string | null;

  note: string | null;

  low_stock_threshold: number;

  low_stock_alert: boolean;

  is_hidden: boolean;

  image_url: string | null;

  server_image_url?: string | null;

  deleted_at: string | null;

  status: "in_stock" | "low_stock" | "out_of_stock";

  created_at: string;

  updated_at: string;

  catalog_product?: CatalogProduct;
};

export type InventoryMeta = {
  page: number;
  limit: number;
  total: number;
};

export type GetProductsResponse = {
  items: Product[];
  meta: InventoryMeta;
};

export type ProductSort =
  | "newest"
  | "oldest"
  | "price_high"
  | "price_low"
  | "quantity_high"
  | "quantity_low";

export type ProductListParams = {
  id?: number;
  search?: string;
  sort?: ProductSort;
  category_id?: number;
  include_hidden?: boolean;
  hide_catalog_products?: boolean;
};

export type ProductInput = {
  name?: string;
  price?: number;
  quantity?: number;
  image?: File | null;
  unit?: string | null;
  remove_image?: boolean;
  low_stock_alert?: boolean;
  description?: string | null;
  category_id?: number | null;
  low_stock_threshold?: number;
};

export const PRODUCT_UNITS = [
  "عدد",
  "کیلوگرم",
  "گرم",
  "بسته",
  "لیتر",
  "متر",
  "جعبه",
] as const;
