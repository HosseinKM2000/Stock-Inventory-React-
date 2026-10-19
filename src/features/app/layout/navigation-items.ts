import type { User } from "@/features/auth/types";
import { isAdmin } from "@/shared/access/authorization";
import {
  ArchiveIcon,
  ClipboardIcon,
  CubeIcon,
  DashboardIcon,
  DownloadIcon,
  GearIcon,
  LayersIcon,
  LockClosedIcon,
  MixIcon,
  MixerHorizontalIcon,
  PersonIcon,
  ReloadIcon,
  StarIcon,
  BookmarkIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import type { ComponentType } from "react";

export type NavigationGroup = "primary" | "settings" | "tools" | "management";

export type NavigationRoute =
  | "/dashboard"
  | "/inventory/list"
  | "/setting"
  | "/setting/profile"
  | "/setting/security"
  | "/setting/appearance"
  | "/setting/backup"
  | "/setting/industry"
  | "/setting/subscription"
  | "/tools"
  | "/tools/categories"
  | "/tools/export"
  | "/tools/catalog"
  | "/tools/recovery"
  | "/tools/import"
  | "/tools/labels"
  | "/management"
  | "/management/subscriptions"
  | "/management/users"
  | "/management/catalogs"
  | "/management/industries";

type NavigationIcon = ComponentType<{ width?: number | string; height?: number | string }>;

export type NavigationItem = {
  id: string;
  label: string;
  description?: string;
  to: NavigationRoute;
  icon: NavigationIcon;
  group: NavigationGroup;
  adminOnly?: boolean;
  requiresOnline?: boolean;
};

const basePrimaryNavigationItems = [
  { id: "dashboard", label: "داشبورد", to: "/dashboard", icon: DashboardIcon, group: "primary" },
  { id: "inventory", label: "محصولات", to: "/inventory/list", icon: MixIcon, group: "primary" },
  { id: "tools", label: "ابزارها", to: "/tools", icon: CubeIcon, group: "primary" },
] as const satisfies readonly NavigationItem[];

const managementPrimaryItem = {
  id: "management",
  label: "مدیریت",
  to: "/management",
  icon: LockClosedIcon,
  group: "primary",
  adminOnly: true,
} as const satisfies NavigationItem;

export const settingsNavigationItems = [
  { id: "local-backup", label: "فایل پشتیبان محلی", description: "ذخیره و بازیابی نسخه کامل داده‌ها روی همین دستگاه", to: "/setting/backup", icon: ArchiveIcon, group: "settings" },
  { id: "profile", label: "پروفایل", description: "اطلاعات حساب و تصویر پروفایل", to: "/setting/profile", icon: PersonIcon, group: "settings", requiresOnline: true },
  { id: "security", label: "امنیت", description: "تغییر رمز عبور و تنظیمات امنیتی", to: "/setting/security", icon: LockClosedIcon, group: "settings", requiresOnline: true },
  { id: "appearance", label: "ظاهر", description: "رنگ و حالت نمایش برنامه", to: "/setting/appearance", icon: MixerHorizontalIcon, group: "settings" },
  { id: "industry", label: "حوزه کاری", description: "انتخاب حوزه فعالیت حساب", to: "/setting/industry", icon: CubeIcon, group: "settings", requiresOnline: true },
  { id: "subscription", label: "اشتراک", description: "طرح، محدودیت‌ها و وضعیت اشتراک من", to: "/setting/subscription", icon: StarIcon, group: "settings", requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export const toolsNavigationItems = [
  { id: "import", label: "ورود از اکسل", description: "بررسی و ورود گروهی محصولات از فایل xlsx، با ذخیره محلی و پشتیبانی آفلاین", to: "/tools/import", icon: UploadIcon, group: "tools" },
  { id: "labels", label: "برچسب‌ها", description: "ساخت برچسب‌های شخصی و اختصاص چند برچسب به هر محصول", to: "/tools/labels", icon: BookmarkIcon, group: "tools" },
  { id: "categories", label: "دسته‌ها", description: "مدیریت دسته‌بندی‌های موجودی، با پشتیبانی آفلاین", to: "/tools/categories", icon: LayersIcon, group: "tools" },
  { id: "export", label: "خروجی", description: "تهیه فایل از داده‌های محلی یا خروجی سرور", to: "/tools/export", icon: DownloadIcon, group: "tools" },
  { id: "catalog", label: "کاتالوگ", description: "کنترل نمایش محصولات کاتالوگی در موجودی", to: "/tools/catalog", icon: ClipboardIcon, group: "tools" },
  { id: "recovery", label: "بازیابی", description: "همگام‌سازی تغییرات و تطبیق دوباره با نسخه سرور", to: "/tools/recovery", icon: ReloadIcon, group: "tools", requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export const managementNavigationItems = [
  { id: "subscription-management", label: "مدیریت اشتراک‌ها", description: "طرح‌ها، قابلیت‌ها و مشترکان", to: "/management/subscriptions", icon: StarIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "users", label: "کاربران", description: "حساب‌ها، نقش‌ها و وضعیت دسترسی", to: "/management/users", icon: LockClosedIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "catalog-management", label: "مدیریت کاتالوگ", description: "محصولات مشترک حوزه‌های کاری", to: "/management/catalogs", icon: ClipboardIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "industry-management", label: "مدیریت حوزه‌ها", description: "ایجاد و نگهداری حوزه‌های کاری", to: "/management/industries", icon: GearIcon, group: "management", adminOnly: true, requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export function visibleNavigationItems(
  items: readonly NavigationItem[],
  user: User | null | undefined,
) {
  return items.filter((item) => !item.adminOnly || isAdmin(user));
}

export function primaryNavigationItems(user: User | null | undefined) {
  return isAdmin(user)
    ? [...basePrimaryNavigationItems, managementPrimaryItem]
    : [...basePrimaryNavigationItems];
}
