export type Industry = {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
  tools: Record<string, boolean>;
};

export type IndustryInput = {
  name: string;
  description: string;
  is_active: boolean;
  tools: Record<string, boolean>;
};

export type Category = {
  id: number;
  local_user_id?: number;
  local_store_id?: number;
  local_key?: string;
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

export type Label = {
  id: number;
  local_user_id?: number;
  local_store_id?: number;
  local_key?: string;
  name: string;
  normalized_name: string;
  version?: number;
  created_at: string;
  updated_at: string;
};

export type LabelInput = { name: string };

export type CatalogProduct = {
  id: number;

  industry_id: number;

  is_active: boolean;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;

  is_packaged: boolean;

  pack_size: number | null;

  created_at: string;

  // Keep industry_id as the stable source of truth. Legacy API responses may
  // not contain the expanded relation, so consumers must handle its absence.
  industry?: Pick<Industry, "id" | "name"> | null;
};

export type CatalogProductInput = {
  industry_id: number;

  name: string;

  description: string | null;

  brand: string | null;

  image_url: string | null;

  is_packaged: boolean;

  pack_size: number | null;
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
  policy_revision: number;
  commercial_status: "legacy_unapproved" | "legacy_only";
  configuration_errors: string[];
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlanInput = Omit<SubscriptionPlan, "created_at" | "updated_at" | "policy_revision" | "commercial_status" | "configuration_errors"> & {
  reason: string;
  expected_revision?: number;
};

export type EntitlementRegistry = {
  capabilities: Array<{ key: string; label_fa: string; status: "implemented" | "planned"; dependencies: string[]; permissions: string[]; enforcement: string[] }>;
  capacities: Array<{ key: string; label_fa: string; unit: string; minimum: number; maximum: number; supports_unlimited: boolean; capability: string | null; enforcement: string[] }>;
  semantics: Record<string, unknown>;
};

export type StorePlanGrant = {
  id: number; request_id: string; store_id: number; plan_id: "pro" | "vip";
  source: string; reason: string; starts_at: string; ends_at: string;
  granted_by_user_id: number; revoked_at: string | null; revoked_by_user_id: number | null;
  revocation_reason: string | null; created_at: string;
};
