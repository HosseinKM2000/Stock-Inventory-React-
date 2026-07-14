import { DashboardFilters, type DashboardStats } from "../types";
import {
  Cross1Icon,
  ExclamationTriangleIcon,
  EyeClosedIcon,
  IdCardIcon,
  MixIcon,
  QuestionMarkIcon,
} from "@radix-ui/react-icons";

export const dashboardCards = [
  {
    filter: null,

    label: "مجموع کالاها",

    value: (s: DashboardStats) =>
      s?.totalProducts.toLocaleString("fa-IR") ?? "0",

    icon: MixIcon ,

    color: "indigo" as const,
  },

  {
    filter: DashboardFilters.LOW_STOCK,

    label: "کمبود موجودی",

    value: (s: DashboardStats) =>
      s?.lowStockCount.toLocaleString("fa-IR") ?? "0",

    icon: ExclamationTriangleIcon,

    color: "yellow" as const,

    badge: {
      text: "نیاز به اقدام",

      color: "yellow" as const,
    },
  },

  {
    filter: DashboardFilters.OUT_OF_STOCK,

    label: "عدم موجودی",

    value: (s: DashboardStats) =>
      s?.outOfStockCount.toLocaleString("fa-IR") ?? "0",

    icon: Cross1Icon,

    color: "red" as const,

    badge: {
      text: "فوری",

      color: "red" as const,
    },
  },

  {
    filter: null,

    label: "ارزش موجودی",

    value: (s: DashboardStats) =>
      `${s?.inventoryValue.toLocaleString("fa-IR") ?? "0"} تومان`,

    icon: IdCardIcon,

    color: "green" as const,
  },

  {
    filter: DashboardFilters.NO_IMAGE,

    label: "بدون تصویر",

    value: (s: DashboardStats) =>
      s?.noImageCount.toLocaleString("fa-IR") ?? "0",

    icon: QuestionMarkIcon,

    color: "orange" as const,
  },

  {
    filter: DashboardFilters.NO_PRICE,

    label: "بدون قیمت",

    value: (s: DashboardStats) =>
      s?.noPriceCount.toLocaleString("fa-IR") ?? "0",

    icon: QuestionMarkIcon,

    color: "gray" as const,
  },

  {
    filter: DashboardFilters.HIDDEN,

    label: "محصولات مخفی",

    value: (s: DashboardStats) => s?.hiddenCount.toLocaleString("fa-IR") ?? "0",

    icon: EyeClosedIcon,

    color: "purple" as const,
  },

  {
    filter: DashboardFilters.URGENT_PURCHASE,

    label: "نیاز به خرید",

    value: (s: DashboardStats) =>
      s?.urgentPurchaseCount.toLocaleString("fa-IR") ?? "0",

    icon: ExclamationTriangleIcon,

    color: "crimson" as const,

    badge: {
      text: "بحرانی",

      color: "red" as const,
    },
  },
];
