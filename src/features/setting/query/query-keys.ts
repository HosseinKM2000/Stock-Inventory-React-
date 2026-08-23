export const industryKeys = {
  all: ["industries"] as const,
};
export const categoryKeys = {
  all: ["categories"] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  users: ["admin", "users"] as const,
  plans: ["admin", "plans"] as const,
  subscribers: (planId: string) => ["admin", "plans", planId, "subscribers"] as const,
  audit: ["admin", "audit"] as const,
};

export const planKeys = {
  all: ["plans"] as const,
  current: ["plans", "current"] as const,
};
export const catalogProductKeys = {
  all: ["catalog-products"] as const,

  list: (search?: string, industryId?: number) =>
    [...catalogProductKeys.all, search, industryId] as const,

  detail: (id: number) => [...catalogProductKeys.all, id] as const,
};
