import type { User } from "@/features/auth/types";
import { isAdmin } from "@/shared/access/authorization";
import { accessState } from "@/shared/access/access-state";
import type { DomainToolId } from "@/shared/access/tools";
import { ActivityLogIcon, ArchiveIcon, BookmarkIcon, ClipboardIcon, CubeIcon, DashboardIcon, DownloadIcon, GearIcon, LayersIcon, LockClosedIcon, MagnifyingGlassIcon, MixIcon, MixerHorizontalIcon, PersonIcon, QuestionMarkCircledIcon, ReloadIcon, StarIcon, UploadIcon } from "@radix-ui/react-icons";
import type { ComponentType } from "react";

export type NavigationGroup = "primary" | "settings" | "tools" | "management";
export type NavigationRoute = "/dashboard" | "/inventory/list" | "/setting" | "/setting/sync" | "/setting/profile" | "/setting/security" | "/setting/appearance" | "/setting/backup" | "/setting/industry" | "/setting/subscription" | "/setting/personnel" | "/tools" | "/tools/scanner" | "/tools/categories" | "/tools/export" | "/tools/catalog" | "/tools/recovery" | "/tools/import" | "/tools/labels" | "/tools/help" | "/tools/activity" | "/management" | "/management/subscriptions" | "/management/users" | "/management/catalogs" | "/management/industries";
type NavigationIcon = ComponentType<{ width?: number | string; height?: number | string }>;

export type NavigationItem = { id: string; label: string; description?: string; to: NavigationRoute; icon: NavigationIcon; group: NavigationGroup; adminOnly?: boolean; ownerOnly?: boolean; storePermission?: string; requiresOnline?: boolean; toolId?: DomainToolId };

const basePrimaryNavigationItems = [
  { id: "dashboard", label: "داشبورد", to: "/dashboard", icon: DashboardIcon, group: "primary" },
  { id: "inventory", label: "محصولات", to: "/inventory/list", icon: MixIcon, group: "primary" },
  { id: "tools", label: "ابزارها", to: "/tools", icon: CubeIcon, group: "primary" },
  { id: "settings", label: "تنظیمات", to: "/setting", icon: GearIcon, group: "primary" },
] as const satisfies readonly NavigationItem[];

export const settingsNavigationItems = [
  { id: "personnel", label: "پرسنل", description: "اعضا، نقش‌ها، مجوزها و ظرفیت مجموعه", to: "/setting/personnel", icon: PersonIcon, group: "settings", ownerOnly: true, requiresOnline: true },
  { id: "sync", label: "همگام‌سازی", description: "وضعیت اتصال، صف تغییرات، آخرین رویدادها و خطاهای همگام‌سازی", to: "/setting/sync", icon: ReloadIcon, group: "settings" },
  { id: "local-backup", label: "فایل پشتیبان محلی", description: "ذخیره و بازیابی نسخه کامل داده‌ها روی همین دستگاه", to: "/setting/backup", icon: ArchiveIcon, group: "settings", ownerOnly: true },
  { id: "profile", label: "پروفایل", description: "اطلاعات حساب و تصویر پروفایل", to: "/setting/profile", icon: PersonIcon, group: "settings", requiresOnline: true },
  { id: "security", label: "امنیت", description: "تغییر رمز عبور و تنظیمات امنیتی", to: "/setting/security", icon: LockClosedIcon, group: "settings", requiresOnline: true },
  { id: "appearance", label: "ظاهر", description: "رنگ و حالت نمایش برنامه", to: "/setting/appearance", icon: MixerHorizontalIcon, group: "settings" },
  { id: "industry", label: "حوزه کاری", description: "انتخاب حوزه فعالیت حساب", to: "/setting/industry", icon: CubeIcon, group: "settings", requiresOnline: true },
  { id: "subscription", label: "اشتراک", description: "طرح، محدودیت‌ها و وضعیت اشتراک مجموعه", to: "/setting/subscription", icon: StarIcon, group: "settings", ownerOnly: true, requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export const toolsNavigationItems = [
  { id: "scanner", toolId: "scanner", storePermission: "barcodes.lookup", label: "اسکنر", description: "جست‌وجو و عملیات امن موجودی با دوربین یا بارکدخوان", to: "/tools/scanner", icon: MagnifyingGlassIcon, group: "tools" },
  { id: "activity", label: "فعالیت مجموعه", description: "تغییرات تأییدشده و ردشده با نام انجام‌دهنده", to: "/tools/activity", icon: ActivityLogIcon, group: "tools", ownerOnly: true, requiresOnline: true },
  { id: "help", label: "راهنمای برنامه", description: "راهنمای کوتاه و مرحله‌به‌مرحله همه بخش‌های برنامه", to: "/tools/help", icon: QuestionMarkCircledIcon, group: "tools" },
  { id: "import", toolId: "import", storePermission: "tools.import", label: "ورود از اکسل", description: "بررسی و ورود گروهی محصولات از فایل xlsx، با ذخیره محلی و پشتیبانی آفلاین", to: "/tools/import", icon: UploadIcon, group: "tools" },
  { id: "labels", toolId: "labels", storePermission: "labels.manage", label: "برچسب‌ها", description: "ساخت برچسب‌های شخصی و اختصاص چند برچسب به هر محصول", to: "/tools/labels", icon: BookmarkIcon, group: "tools" },
  { id: "categories", toolId: "categories", storePermission: "categories.manage", label: "دسته‌ها", description: "مدیریت دسته‌بندی‌های موجودی، با پشتیبانی آفلاین", to: "/tools/categories", icon: LayersIcon, group: "tools" },
  { id: "export", toolId: "export", storePermission: "tools.export", label: "خروجی", description: "تهیه فایل از داده‌های محلی یا خروجی سرور", to: "/tools/export", icon: DownloadIcon, group: "tools" },
  { id: "catalog", toolId: "catalog", storePermission: "tools.catalog", label: "کاتالوگ", description: "کنترل نمایش محصولات کاتالوگی در موجودی", to: "/tools/catalog", icon: ClipboardIcon, group: "tools" },
  { id: "recovery", toolId: "recovery", label: "بازیابی", description: "همگام‌سازی تغییرات و تطبیق دوباره با نسخه سرور", to: "/tools/recovery", icon: ReloadIcon, group: "tools", requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export const managementNavigationItems = [
  { id: "subscription-management", label: "مدیریت اشتراک‌ها", description: "طرح‌ها، قابلیت‌ها و مشترکان", to: "/management/subscriptions", icon: StarIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "users", label: "کاربران", description: "حساب‌ها، نقش‌ها و وضعیت دسترسی", to: "/management/users", icon: LockClosedIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "catalog-management", label: "مدیریت کاتالوگ", description: "محصولات مشترک حوزه‌های کاری", to: "/management/catalogs", icon: ClipboardIcon, group: "management", adminOnly: true, requiresOnline: true },
  { id: "industry-management", label: "مدیریت حوزه‌ها", description: "ایجاد و نگهداری حوزه‌های کاری", to: "/management/industries", icon: GearIcon, group: "management", adminOnly: true, requiresOnline: true },
] as const satisfies readonly NavigationItem[];

export function visibleNavigationItems(items: readonly NavigationItem[], user: User | null | undefined) { const administrator = isAdmin(user); return items.filter((item) => (!item.adminOnly || administrator) && (!item.ownerOnly || administrator || user?.is_store_owner !== false) && (!item.storePermission || accessState.hasStorePermission(item.storePermission)) && (!item.toolId || accessState.canUseTool(item.toolId))); }
export function primaryNavigationItems(user: User | null | undefined) { void user; return [...basePrimaryNavigationItems]; }
