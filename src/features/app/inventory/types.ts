export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";

export type CatalogProduct = {
  id: number;

  industry_id: number;

  /** Missing on legacy snapshots; only an explicit false makes it ineligible. */
  is_active?: boolean;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;

  is_packaged: boolean;

  pack_size: number | null;

  created_at: string;
};

export type Product = {
  id: number;

  local_user_id?: number;
  local_store_id?: number;
  local_key?: string;

  catalog_product_id: number;

  is_catalog_backed: boolean;

  category_id: number | null;

  label_ids?: number[];

  version?: number;

  quantity: number;

  price: number;

  /** Canonical optional sale price. `price` remains its legacy wire alias. */
  sale_price?: number | null;

  /** Optional acquisition cost in integer toman. */
  purchase_price?: number | null;

  /** Distinguishes absent/corrupt legacy prices from a valid zero price. */
  price_missing?: boolean;

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
  label_ids?: number[];
  include_hidden?: boolean;
  hide_catalog_products?: boolean;
};

export type ProductInput = {
  name?: string;
  price?: number;
  sale_price?: number | null;
  purchase_price?: number | null;
  quantity?: number;
  image?: File | null;
  unit?: string | null;
  remove_image?: boolean;
  low_stock_alert?: boolean;
  description?: string | null;
  category_id?: number | null;
  label_ids?: number[];
  low_stock_threshold?: number;
  is_packaged?: boolean;
  pack_size?: number | null;
  custom_label?: string | null;
  note?: string | null;
  image_url?: string | null;
  is_hidden?: boolean;
  catalog_product?: CatalogProduct;
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
