import type { DashboardFilter } from "../types";

export const dashboardKeys = {
  all: ["dashboard"] as const,

  stats: () => ["dashboard", "stats"] as const,

  products: (filter: DashboardFilter) =>
    ["dashboard", "products", filter] as const,
};
