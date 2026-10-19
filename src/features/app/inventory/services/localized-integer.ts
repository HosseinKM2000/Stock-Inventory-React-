const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeIntegerText(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[,٬]/g, "")
    .replace(/\D/g, "");
}

export function normalizeOptionalInteger(value: string): number | undefined {
  const normalized = normalizeIntegerText(value);
  return normalized === "" ? undefined : Number(normalized);
}
