export type CategoryBreakdown = {
  name: string;
  value: number;
};

import type { Product } from "../inventory/types";

export const DashboardFilters = {
  LOW_STOCK: "low-stock",
  OUT_OF_STOCK: "out-of-stock",
  NO_IMAGE: "no-image",
  NO_PRICE: "no-price",
  HIDDEN: "hidden",
  URGENT_PURCHASE: "urgent-purchase",
} as const;

export type DashboardFilter =
  (typeof DashboardFilters)[keyof typeof DashboardFilters];

export type DashboardStats = {
  totalProducts: number;

  inventoryValue: number;

  lowStockCount: number;

  outOfStockCount: number;

  hiddenCount: number;

  noImageCount: number;

  noPriceCount: number;

  urgentPurchaseCount: number;
};

export type DashboardProductList = {
  title: string;

  products: Product[];
};