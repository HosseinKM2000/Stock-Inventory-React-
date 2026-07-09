import {
  PersonIcon,
  LayersIcon,
  DownloadIcon,
  MixerHorizontalIcon,
  CubeIcon,
  ClipboardIcon,
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
  {
    label: "حوزه کاری",
    to: "/setting/industry",
    icon: CubeIcon,
  },
  {
    label: "کاتالوگ",
    to: "/setting/catalogs",
    icon: ClipboardIcon,
  },
] as const;
