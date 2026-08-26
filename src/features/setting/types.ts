export type Industry = {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
};

export type IndustryInput = {
  name: string;
  description: string;
  is_active: boolean;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type CategoryInput = {
  id?: number;
  name: string;
  description?: string | null;
};

export type CatalogProduct = {
  id: number;

  industry_id: number;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;

  created_at: string;

  industry: Pick<Industry, "id" | "name">;
};

export type CatalogProductInput = {
  industry_id: number;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;
};

export type CatalogProductUpdate = Partial<CatalogProductInput>;

export type CatalogProductListParams = {
  search?: string;
  industry_id?: number;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  price_minor: number | null;
  currency: string;
  duration: number | null;
  duration_unit: "day" | "month" | "year" | null;
  is_active: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlanInput = Omit<SubscriptionPlan, "created_at" | "updated_at">;
