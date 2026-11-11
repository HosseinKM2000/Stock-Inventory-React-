export type CategoryBreakdown = {
  name: string;
  value: number;
};

import type { Product } from "../inventory/types";
import type {
  ClassificationResult,
  RankedCategoryValue,
  RankedProductValue,
  TodayActions,
} from "./services/dashboard-selectors";

export const DashboardFilters = {
  ALL: "all",
  TODAY: "today",
  INVENTORY_VALUE: "inventory-value",
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

  addedTodayCount: number;

  missingClassificationCount: number;

  valuedProductsCount: number;

  todayActionCount: number;
};

export type DashboardProductList = {
  title: string;

  products: Product[];
};

export type DashboardAnalysis = {
  products: Product[];
  productValues: RankedProductValue[];
  categoryValues: RankedCategoryValue[];
  excludedUncategorizedValue: number;
  missingPriceCount: number;
  classification: ClassificationResult;
  actions: TodayActions;
};
