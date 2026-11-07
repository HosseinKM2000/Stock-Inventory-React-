import type { DashboardFilter } from "../types";

export const dashboardKeys = {
  all: ["dashboard"] as const,

  stats: () => ["dashboard", "stats"] as const,

  analysis: () => ["dashboard", "analysis"] as const,

  products: (filter: DashboardFilter) =>
    ["dashboard", "products", filter] as const,
};
