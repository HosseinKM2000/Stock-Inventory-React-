import {
  PersonIcon,
  LayersIcon,
  DownloadIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";

export const settingsNavItems = [
  {
    label: "پروفایل",
    to: "/setting/profile",
    icon: PersonIcon,
  },
  {
    label: "ظاهر",
    to: "/setting/appearance",
    icon: MixerHorizontalIcon,
  },
  {
    label: "دسته‌ها",
    to: "/setting/categories",
    icon: LayersIcon,
  },
  {
    label: "خروجی",
    to: "/setting/export",
    icon: DownloadIcon,
  },
] as const;
