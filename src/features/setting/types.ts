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
};

export type CatalogProductInput = {
  industry_id: number;

  name: string;

  description: string;

  brand: string;

  image_url: string;
};

export type CatalogProductUpdate = Partial<CatalogProductInput>;
