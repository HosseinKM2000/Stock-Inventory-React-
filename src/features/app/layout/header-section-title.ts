const SECTION_TITLES: Record<string, string> = {
  dashboard: "داشبورد",
  inventory: "محصولات",
  tools: "ابزارها",
  setting: "تنظیمات",
  management: "مدیریت",
  industry: "حوزه کاری",
};

const SUBSECTION_TITLES: Record<string, string> = {
  "/dashboard/financial": "نمای مالی",
  "/dashboard/reports": "گزارش‌ها",
  "/dashboard/products/actions": "اقدام‌های پیشنهادی",
  "/dashboard/products/all": "همه محصولات",
  "/dashboard/products/hidden": "محصولات پنهان",
  "/dashboard/products/highest-value": "بیشترین ارزش",
  "/dashboard/products/inventory-value": "ارزش موجودی",
  "/dashboard/products/low-stock": "کم‌موجود",
  "/dashboard/products/no-image": "بدون تصویر",
  "/dashboard/products/no-price": "بدون قیمت",
  "/dashboard/products/out-of-stock": "ناموجود",
  "/dashboard/products/today": "تغییرات امروز",
  "/dashboard/products/unclassified": "دسته‌بندی‌نشده",
  "/dashboard/products/urgent-purchase": "نیازمند خرید",
  "/inventory/add": "افزودن محصول",
  "/inventory/edit": "ویرایش محصول",
  "/setting/profile": "پروفایل",
  "/setting/appearance": "ظاهر",
  "/setting/security": "امنیت",
  "/setting/industry": "حوزه کاری",
  "/setting/personnel": "پرسنل",
  "/setting/roles": "نقش‌ها",
  "/setting/sync": "همگام‌سازی",
  "/setting/backup": "پشتیبان محلی",
  "/setting/subscription": "اشتراک من",
  "/setting/update": "بروزرسانی",
  "/tools/invoices": "فاکتورها",
  "/tools/counterparties": "طرف‌حساب‌ها",
  "/tools/scanner": "اسکنر",
  "/tools/activity": "فعالیت مجموعه",
  "/tools/help": "راهنما",
  "/tools/import": "ورود از اکسل",
  "/tools/labels": "برچسب‌ها",
  "/tools/categories": "دسته‌بندی‌ها",
  "/tools/export": "خروجی",
  "/tools/catalog": "کاتالوگ",
  "/tools/recovery": "بازیابی",
  "/management/subscriptions": "اشتراک‌ها",
  "/management/users": "کاربران",
  "/management/catalogs": "کاتالوگ",
  "/management/industries": "حوزه‌ها",
};

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function getHeaderSectionTitle(pathname: string): string {
  const normalizedPath = normalizePathname(pathname);
  const rootSegment = normalizedPath.split("/").filter(Boolean)[0];
  const sectionTitle = SECTION_TITLES[rootSegment] ?? "داشبورد";
  const subsectionTitle = SUBSECTION_TITLES[normalizedPath];
  return subsectionTitle ? `${sectionTitle} · ${subsectionTitle}` : sectionTitle;
}
