export const industryKeys = {
  all: ["industries"] as const,
};
export const categoryKeys = {
  all: ["categories"] as const,
};
export const catalogProductKeys = {
  all: ["catalog-products"] as const,

  list: (search?: string, industryId?: number) =>
    [...catalogProductKeys.all, search, industryId] as const,

  detail: (id: number) => [...catalogProductKeys.all, id] as const,
};
