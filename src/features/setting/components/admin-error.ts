import { ApiError } from "@/shared/api/api-error";

const messages: Record<string, string> = {
  SYSTEM_ADMIN_IMMUTABLE: "حساب مدیر دائمی سیستم قابل حذف، غیرفعال‌سازی یا تنزل نقش نیست.",
  CANNOT_DISABLE_SELF: "نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.",
  CANNOT_DELETE_SELF: "نمی‌توانید حساب کاربری خودتان را حذف کنید.",
  USER_NOT_FOUND: "کاربر مورد نظر پیدا نشد.",
  PLAN_NOT_FOUND: "طرح اشتراک مورد نظر پیدا نشد.",
  PLAN_INACTIVE: "این طرح اشتراک غیرفعال است.",
  PLAN_EXISTS: "طرحی با این شناسه از قبل وجود دارد.",
  PLAN_DURATION_INVALID: "مدت و واحد مدت طرح باید با هم وارد یا هر دو خالی شوند.",
  ADMIN_REQUIRED: "برای انجام این عملیات دسترسی مدیر لازم است.",
  ACCOUNT_DISABLED: "این حساب کاربری غیرفعال شده است.",
};

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return messages[error.message] ?? fallback;
  return fallback;
}
