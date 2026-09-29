export type PlanFeatureOption = {
  key: string;
  label: string;
  description: string;
  group: "آفلاین و موجودی" | "داده و خروجی";
};

export const PLAN_FEATURE_OPTIONS: readonly PlanFeatureOption[] = [
  { key: "inventory.read", label: "مشاهده موجودی", description: "دسترسی خواندن به فهرست و جزئیات کالاها", group: "آفلاین و موجودی" },
  { key: "inventory.write", label: "مدیریت محصولات", description: "ایجاد، ویرایش و حذف آفلاین‌محور محصولات", group: "آفلاین و موجودی" },
  { key: "categories.write", label: "مدیریت دسته‌بندی‌ها", description: "ایجاد و ویرایش دسته‌بندی‌های موجودی", group: "آفلاین و موجودی" },
  { key: "export.local", label: "خروجی آفلاین", description: "ساخت خروجی از داده‌های محلی دستگاه", group: "داده و خروجی" },
  { key: "export.server", label: "خروجی آنلاین", description: "ساخت خروجی کامل با پردازش سرور", group: "داده و خروجی" },
  { key: "backup", label: "پشتیبان‌گیری", description: "دریافت نسخه پشتیبان آنلاین", group: "داده و خروجی" },
];

export const PLAN_LIMIT_OPTIONS = [
  { key: "inventory_items", label: "حداکثر تعداد کالا", description: "خالی به معنی نامحدود" },
  { key: "devices", label: "حداکثر دستگاه فعال", description: "خالی به معنی نامحدود" },
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
