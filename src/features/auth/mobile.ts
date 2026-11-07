const digitMap: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export const INVALID_MOBILE_MESSAGE = "شماره موبایل معتبر نیست.";
export const DUPLICATE_MOBILE_MESSAGE = "این شماره موبایل قبلاً ثبت شده است.";

export function normalizeIranianMobile(value: string): string | null {
  let normalized = value.trim().replace(/[۰-۹٠-٩]/g, (digit) => digitMap[digit]);
  if (normalized.startsWith("+98")) normalized = `0${normalized.slice(3)}`;
  else if (normalized.startsWith("0098")) normalized = `0${normalized.slice(4)}`;
  return /^09\d{9}$/.test(normalized) ? normalized : null;
}
