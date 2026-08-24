import { GearIcon, HomeIcon, MixIcon } from "@radix-ui/react-icons";

export const primaryNavigationItems = [
  { label: "خانه", to: "/dashboard", icon: HomeIcon },
  { label: "محصولات", to: "/inventory/list", icon: MixIcon },
  { label: "تنظیمات", to: "/setting/profile", icon: GearIcon },
] as const;
