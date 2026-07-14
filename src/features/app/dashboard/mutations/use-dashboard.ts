import { useQuery } from "@tanstack/react-query";

import { dashboardService } from "../services/dashboard.service";
import { dashboardKeys } from "../query/dashboard-query-keys";

import type { DashboardFilter } from "../types";

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),

    queryFn: () => dashboardService.getStats(),

    staleTime: 0,
  });
}

export function useDashboardProducts(filter: DashboardFilter) {
  return useQuery({
    queryKey: dashboardKeys.products(filter),

    queryFn: () => dashboardService.getProducts(filter),

    staleTime: 0,

    enabled: !!filter,
  });
}
