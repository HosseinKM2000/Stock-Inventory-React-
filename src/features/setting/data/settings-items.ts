import {
  PersonIcon,
  LayersIcon,
  DownloadIcon,
  MixerHorizontalIcon,
  CubeIcon,
  ClipboardIcon,
  LockClosedIcon,
  StarIcon,
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
  {
    label: "اشتراک",
    to: "/setting/subscription",
    icon: StarIcon,
  },
  {
    label: "کاربران",
    to: "/setting/users",
    icon: LockClosedIcon,
    adminOnly: true,
  },
  {
    label: "مدیریت اشتراک‌ها",
    to: "/setting/subscription-management",
    icon: StarIcon,
    adminOnly: true,
  },
] as const;
