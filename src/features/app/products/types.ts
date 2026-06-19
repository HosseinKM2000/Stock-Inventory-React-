export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";

export type Product = {
  id: number;
  name: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  price: number;
  low_stock_threshold: number;
  low_stock_alert: boolean;
  image_url: string | null;
  category_id: number | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

export type ProductSort = "newest" | "price_desc" | "price_asc" | "name";

export type ProductListParams = {
  search?: string;
  sort?: ProductSort;
  category_id?: number;
};

export type ProductInput = {
  name?: string;
  description?: string | null;
  unit?: string | null;
  quantity?: number;
  price?: number;
  low_stock_threshold?: number;
  low_stock_alert?: boolean;
  category_id?: number | null;
  image?: File | null;
  remove_image?: boolean;
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
