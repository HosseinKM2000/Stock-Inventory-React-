import { ApiError } from "@/shared/api/api-error";

const messages: Record<string, string> = {
  SYSTEM_ADMIN_IMMUTABLE: "حساب مدیر دائمی سیستم قابل حذف، غیرفعال‌سازی یا تنزل نقش نیست.",
  CANNOT_DISABLE_SELF: "نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.",
  CANNOT_DELETE_SELF: "نمی‌توانید حساب کاربری خودتان را حذف کنید.",
  CANNOT_DEMOTE_SELF: "نمی‌توانید دسترسی مدیریت حساب خودتان را لغو کنید.",
  USER_NOT_FOUND: "کاربر مورد نظر پیدا نشد.",
  PLAN_NOT_FOUND: "طرح اشتراک مورد نظر پیدا نشد.",
  PLAN_INACTIVE: "این طرح اشتراک غیرفعال است.",
  PLAN_EXISTS: "طرحی با این شناسه از قبل وجود دارد.",
  PLAN_DURATION_INVALID: "مدت و واحد مدت طرح باید با هم وارد یا هر دو خالی شوند.",
  PLAN_CAPABILITY_INVALID: "یکی از قابلیت‌های طرح توسط مدل دسترسی سرور پشتیبانی نمی‌شود.",
  PLAN_BUILT_IN: "طرح‌های پیش‌فرض سیستم قابل حذف نیستند.",
  PLAN_HAS_SUBSCRIBERS: "تا زمانی که کاربری عضو این طرح است، امکان حذف آن وجود ندارد.",
  INDUSTRY_HAS_CATALOG_PRODUCTS: "محصولات کاتالوگ به این حوزه کاری وابسته هستند و مانع حذف آن می‌شوند.",
  INDUSTRY_HAS_USERS: "کاربران به این حوزه کاری وابسته هستند و تا زمان تغییر حوزه آن‌ها، حذف امکان‌پذیر نیست.",
  INDUSTRY_EXISTS: "حوزه کاری دیگری با این نام وجود دارد.",
  CATALOG_PRODUCT_EXISTS: "محصول کاتالوگ دیگری با این نام در این حوزه کاری وجود دارد.",
  ADMIN_REQUIRED: "برای انجام این عملیات دسترسی مدیر لازم است.",
  ACCOUNT_DISABLED: "این حساب کاربری غیرفعال شده است.",
};

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return messages[error.message] ?? fallback;
  return fallback;
}
