const messages: Record<string, string> = {
  BACKUP_ACCOUNT_REQUIRED: "برای ذخیره فایل پشتیبان باید وارد حساب شوید.",
  BACKUP_DESTINATION_MISSING: "مقصد قبلی در دسترس نیست؛ آن را دوباره متصل کنید.",
  BACKUP_PREPARE_VERIFICATION_FAILED: "فایل آماده‌شده کامل نبود؛ فضای ذخیره‌سازی و مقصد را بررسی کنید.",
  BACKUP_INVALID_JSON: "فایل انتخاب‌شده یک فایل پشتیبان معتبر نیست.",
  BACKUP_FORMAT_INVALID: "قالب فایل پشتیبان شناخته نشد.",
  BACKUP_SCHEMA_UNSUPPORTED: "نسخه این فایل پشتیبان با برنامه سازگار نیست.",
  BACKUP_OWNER_MISMATCH: "این فایل پشتیبان متعلق به حساب فعلی نیست.",
  BACKUP_STRUCTURE_INVALID: "ساختار فایل پشتیبان ناقص یا نامعتبر است.",
  BACKUP_COUNTS_INVALID: "تعداد رکوردهای فایل پشتیبان با محتوای آن هم‌خوانی ندارد.",
  BACKUP_INTEGRITY_FAILED: "سلامت فایل پشتیبان تأیید نشد.",
  BACKUP_REVISION_INVALID: "نسخه ثبت‌شده فایل پشتیبان معتبر نیست.",
  BACKUP_RESTORE_BUSY: "یک عملیات پشتیبان یا بازیابی دیگر در حال اجرا است.",
  BACKUP_RECONCILIATION_REQUIRES_ONLINE: "برای تطبیق امن داده‌های بازیابی‌شده، ابتدا به اینترنت متصل شوید.",
  BACKUP_RECONCILIATION_FAILED: "تطبیق با سرور کامل نشد؛ همگام‌سازی همچنان متوقف است.",
};

export function backupErrorMessage(error: unknown, fallback = "عملیات فایل پشتیبان ناموفق بود") {
  const value = error instanceof Error ? error.message : String(error || "");
  return messages[value] ?? (value && !value.startsWith("BACKUP_") ? value : fallback);
}
