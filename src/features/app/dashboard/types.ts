export type CategoryBreakdown = {
  name: string;
  value: number;
};

export type DashboardStats = {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value: number;
  category_breakdown: CategoryBreakdown[];
};
