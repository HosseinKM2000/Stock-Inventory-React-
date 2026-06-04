import {
  ExternalLinkIcon,
  GridIcon,
  Pencil1Icon,
  PersonIcon,
} from "@radix-ui/react-icons";

export const sidebarItems = [
  {
    label: "پروفایل",
    icon: PersonIcon,
    to: "/setting/profile",
  },
  {
    label: "ظاهر برنامه",
    icon: Pencil1Icon,
    to: "/setting/appearance",
  },
  {
    label: "دسته‌بندی‌ها",
    icon: GridIcon,
    to: "/setting/categories",
  },
  {
    label: "گرفتن خروجی",
    icon: ExternalLinkIcon,
    to: "/setting/export",
  },
];
