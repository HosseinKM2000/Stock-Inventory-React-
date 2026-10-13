import {
  Cross1Icon,
  ExclamationTriangleIcon,
  EyeClosedIcon,
  IdCardIcon,
  LightningBoltIcon,
  MixIcon,
  PlusCircledIcon,
  QuestionMarkIcon,
} from "@radix-ui/react-icons";
import type { DashboardStats } from "../types";

type DashboardCard = {
  id: string;
  to:
    | "/dashboard/products/all"
    | "/dashboard/products/out-of-stock"
    | "/dashboard/products/low-stock"
    | "/dashboard/products/urgent-purchase"
    | "/dashboard/products/no-price"
    | "/dashboard/products/actions"
    | "/dashboard/products/unclassified"
    | "/dashboard/products/no-image"
    | "/dashboard/products/highest-value"
    | "/dashboard/products/inventory-value"
    | "/dashboard/products/today"
    | "/dashboard/products/hidden";
  label: string;
  value: (stats: DashboardStats) => string;
  icon: typeof MixIcon;
  color: "indigo" | "red" | "yellow" | "crimson" | "gray" | "orange" | "amber" | "green" | "cyan" | "purple";
  badge?: { text: string; color: "red" | "yellow" };
};

export const dashboardCards: DashboardCard[] = [
  { id: "all", to: "/dashboard/products/all", label: "مجموع کالاها", value: (s: DashboardStats) => s.totalProducts.toLocaleString("fa-IR"), icon: MixIcon, color: "indigo" as const },
  { id: "out-of-stock", to: "/dashboard/products/out-of-stock", label: "عدم موجودی", value: (s: DashboardStats) => s.outOfStockCount.toLocaleString("fa-IR"), icon: Cross1Icon, color: "red" as const, badge: { text: "فوری", color: "red" as const } },
  { id: "low-stock", to: "/dashboard/products/low-stock", label: "کمبود موجودی", value: (s: DashboardStats) => s.lowStockCount.toLocaleString("fa-IR"), icon: ExclamationTriangleIcon, color: "yellow" as const, badge: { text: "نیاز به اقدام", color: "yellow" as const } },
  { id: "urgent-purchase", to: "/dashboard/products/urgent-purchase", label: "نیاز به خرید", value: (s: DashboardStats) => s.urgentPurchaseCount.toLocaleString("fa-IR"), icon: ExclamationTriangleIcon, color: "crimson" as const, badge: { text: "بحرانی", color: "red" as const } },
  { id: "no-price", to: "/dashboard/products/no-price", label: "بدون قیمت", value: (s: DashboardStats) => s.noPriceCount.toLocaleString("fa-IR"), icon: QuestionMarkIcon, color: "gray" as const },
  { id: "actions", to: "/dashboard/products/actions", label: "اقدام‌های امروز", value: (s: DashboardStats) => `${s.todayActionCount.toLocaleString("fa-IR")} اقدام`, icon: LightningBoltIcon, color: "orange" as const },
  { id: "unclassified", to: "/dashboard/products/unclassified", label: "محصولات بدون دسته یا برچسب", value: (s: DashboardStats) => s.missingClassificationCount.toLocaleString("fa-IR"), icon: QuestionMarkIcon, color: "amber" as const },
  { id: "no-image", to: "/dashboard/products/no-image", label: "بدون تصویر", value: (s: DashboardStats) => s.noImageCount.toLocaleString("fa-IR"), icon: QuestionMarkIcon, color: "orange" as const },
  { id: "highest-value", to: "/dashboard/products/highest-value", label: "ارزشمندترین‌ها", value: (s: DashboardStats) => `${s.valuedProductsCount.toLocaleString("fa-IR")} محصول`, icon: IdCardIcon, color: "green" as const },
  { id: "inventory-value", to: "/dashboard/products/inventory-value", label: "ارزش موجودی", value: (s: DashboardStats) => `${s.inventoryValue.toLocaleString("fa-IR")} تومان`, icon: IdCardIcon, color: "green" as const },
  { id: "today", to: "/dashboard/products/today", label: "محصولات افزوده‌شده امروز", value: (s: DashboardStats) => s.addedTodayCount.toLocaleString("fa-IR"), icon: PlusCircledIcon, color: "cyan" as const },
  { id: "hidden", to: "/dashboard/products/hidden", label: "محصولات مخفی", value: (s: DashboardStats) => s.hiddenCount.toLocaleString("fa-IR"), icon: EyeClosedIcon, color: "purple" as const },
];
