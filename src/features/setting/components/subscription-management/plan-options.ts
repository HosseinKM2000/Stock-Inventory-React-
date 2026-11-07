import { CAPABILITIES } from "@/shared/access/capabilities";

export type PlanFeatureOption = {
  key: string;
  label: string;
  description: string;
  group: "آفلاین و موجودی" | "داده و خروجی" | "ابری و تیمی";
};

export const PLAN_FEATURE_OPTIONS: readonly PlanFeatureOption[] = [
  { key: "inventory.read", label: "مشاهده موجودی", description: "دسترسی خواندن به فهرست و جزئیات کالاها", group: "آفلاین و موجودی" },
  { key: "inventory.write", label: "مدیریت محصولات", description: "ایجاد، ویرایش و حذف آفلاین‌محور محصولات", group: "آفلاین و موجودی" },
  { key: "categories.write", label: "مدیریت دسته‌بندی‌ها", description: "ایجاد و ویرایش دسته‌بندی‌های موجودی", group: "آفلاین و موجودی" },
  { key: "export.local", label: "خروجی آفلاین", description: "ساخت خروجی از داده‌های محلی دستگاه", group: "داده و خروجی" },
  { key: "export.server", label: "خروجی آنلاین", description: "ساخت خروجی کامل با پردازش سرور", group: "داده و خروجی" },
  { key: "backup", label: "پشتیبان‌گیری محلی", description: "ساخت و بازیابی فایل پشتیبان روی دستگاه", group: "داده و خروجی" },
  { key: "catalog.use", label: "کاتالوگ حوزه کاری", description: "استفاده از اقلام آماده کاتالوگ تا سقف طرح", group: "آفلاین و موجودی" },
  { key: "barcode.lookup", label: "اسکنر و جست‌وجوی بارکد", description: "اسکن و پیدا کردن کالای محلی", group: "آفلاین و موجودی" },
  { key: "invoices.purchase", label: "فاکتور خرید محلی", description: "ثبت، چاپ و خروجی فاکتور خرید روی دستگاه", group: "آفلاین و موجودی" },
  { key: "invoices.sale", label: "فاکتور فروش محلی", description: "ثبت، چاپ و خروجی فاکتور فروش روی دستگاه", group: "آفلاین و موجودی" },
  { key: "sync", label: "همگام‌سازی ابری", description: "ارسال عملیات و دریافت تاریخچه از سرور", group: "ابری و تیمی" },
  { key: "personnel", label: "کاربران تیم و نقش‌ها", description: "حساب مستقل، نقش و ثبت فعالیت برای هر همکار", group: "ابری و تیمی" },
  { key: CAPABILITIES.bulkEdit, label: "ویرایش گروهی", description: "نقطه پیکربندی آینده؛ اکنون بدون محدودیت تجاری فعال است", group: "آفلاین و موجودی" },
  { key: CAPABILITIES.labelsWrite, label: "مدیریت برچسب‌ها", description: "نقطه پیکربندی آینده برای برچسب‌های شخصی", group: "آفلاین و موجودی" },
  { key: CAPABILITIES.importXlsx, label: "ورود از اکسل", description: "نقطه پیکربندی آینده برای ورود گروهی محلی", group: "داده و خروجی" },
];

export const PLAN_LIMIT_OPTIONS = [
  { key: "inventory_items", label: "حداکثر تعداد کالا", description: "خالی به معنی نامحدود" },
  { key: "catalog_items", label: "حداکثر کالای کاتالوگی", description: "بخشی از سقف کل کالا و نه ظرفیتی جداگانه" },
  { key: "active_personnel", label: "حداکثر پرسنل فعال", description: "مالک در این عدد محاسبه نمی‌شود" },
  { key: "devices", label: "دستگاه فعال", description: "در همه طرح‌ها نامحدود؛ چندکاربره فقط با طرح تیم" },
] as const;

export const FEATURE_LABELS = Object.fromEntries(
  PLAN_FEATURE_OPTIONS.map((option) => [option.key, option.label]),
) as Record<string, string>;

export function priceMinorToToman(value: number | null): number | null {
  return value == null ? null : value / 10;
}

export function tomanToPriceMinor(value: number | null): number | null {
  return value == null ? null : value * 10;
}

export function formatToman(value: number | null): string {
  const toman = priceMinorToToman(value);
  return toman == null ? "تعیین نشده" : `${new Intl.NumberFormat("fa-IR").format(toman)} تومان`;
}

export function formatPlanPrice(plan: { id: string; price_toman: number | null }): string {
  if (plan.id === "free") return "رایگان";
  if (plan.price_toman == null) return "قیمت طرح پولی تعیین نشده";
  return `${new Intl.NumberFormat("fa-IR").format(plan.price_toman)} تومان`;
}
