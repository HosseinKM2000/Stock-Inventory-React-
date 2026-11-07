const codePattern = /^[A-Z][A-Z0-9_.:-]+$/;

export function diagnosticErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return codePattern.test(message) ? message : null;
}

export function userErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message && /[\u0600-\u06ff]/.test(message) && !codePattern.test(message)) return message;
  if (/network|fetch|offline|timeout/i.test(message)) return `${fallback} اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.`;
  if (/PERMISSION|FORBIDDEN|UNAUTHORIZED|MEMBERSHIP/i.test(message)) return `${fallback} دسترسی فعلی شما برای این کار کافی نیست؛ از مالک مجموعه بخواهید نقش شما را بررسی کند.`;
  if (/ENTITLEMENT|CAPABILITY|PLAN_REQUIRED|CAPACITY|LIMIT_REACHED/i.test(message)) return `${fallback} طرح یا ظرفیت فعلی اجازه این کار را نمی‌دهد؛ جزئیات اشتراک را بررسی کنید.`;
  if (/TEAM_ONLINE_REQUIRED/i.test(message)) return `${fallback} در حالت تیمی این کار فقط با اتصال اینترنت و پذیرش سرور انجام می‌شود.`;
  if (/LOCKING_UNAVAILABLE/i.test(message)) return `${fallback} این مرورگر امکان محافظت ایمن از این تغییر را ندارد؛ از مرورگر پشتیبانی‌شده استفاده کنید.`;
  if (/VERSION|CONFLICT|STALE|POLICY/i.test(message)) return `${fallback} اطلاعات تازه‌تری ثبت شده است؛ صفحه را تازه کنید و مورد را دوباره بررسی کنید.`;
  if (/UNCERTAIN|UNKNOWN|MISMATCH|FINGERPRINT/i.test(message)) return `${fallback} نتیجه درخواست قطعی نیست؛ همان کار را تکرار نکنید و بخش بازیابی را بررسی کنید.`;
  return `${fallback} دوباره تلاش کنید؛ اگر مشکل ادامه داشت، کد پیگیری را برای پشتیبانی نگه دارید.`;
}
