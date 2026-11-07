import { ApiError } from "@/shared/api/api-error";

const messages: Record<string, string> = {
  "Invalid credentials": "نام کاربری یا رمز عبور صحیح نیست.",
  "Username already exists": "این نام کاربری قبلاً ثبت شده است.",
  "Device limit reached for your plan.": "تعداد دستگاه‌های فعال حساب شما به سقف طرح رسیده است.",
  ACCOUNT_DISABLED: "این حساب کاربری غیرفعال شده است.",
  CURRENT_PASSWORD_INCORRECT: "رمز عبور فعلی صحیح نیست.",
  NEW_PASSWORD_MUST_DIFFER: "رمز عبور جدید باید با رمز فعلی متفاوت باشد.",
  PASSWORD_TOO_LONG: "رمز عبور از حداکثر طول امن پشتیبانی‌شده بیشتر است.",
};

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return messages[error.message] ?? fallback;
  return fallback;
}
