import { DashboardIcon, GearIcon, MixIcon } from "@radix-ui/react-icons";

export const primaryNavigationItems = [
  { label: "داشبورد", to: "/dashboard", icon: DashboardIcon },
  { label: "محصولات", to: "/inventory/list", icon: MixIcon },
  { label: "تنظیمات", to: "/setting/profile", icon: GearIcon },
] as const;
