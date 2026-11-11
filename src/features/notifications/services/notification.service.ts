import type { Product } from "@/features/app/inventory/types";
import type { BackupStatus } from "@/features/backup/types";
import type { BackupNotification, InventoryNotification, UpdateNotification } from "../types";
import type { AppUpdateSnapshot } from "@/features/app-update/types";
import { backupErrorMessage } from "@/features/backup/services/backup-error";
import type { User } from "@/features/auth/types";
import type { ProfileNotification } from "../types";

function productName(product: Product): string {
  return product.custom_label?.trim() || product.catalog_product?.name?.trim() || "محصول بدون نام";
}

function deriveProductNotification(product: Product): InventoryNotification | null {
  if (product.deleted_at || product.is_hidden) return null;

  const name = productName(product);
  const base = {
    id: `inventory-alert-${product.id}`,
    productId: product.id,
    productName: name,
    context: `موجودی فعلی: ${product.quantity.toLocaleString("fa-IR")}`,
  };

  if (product.quantity <= 0 || product.status === "out_of_stock") {
    return {
      ...base,
      kind: "out_of_stock",
      severity: "critical",
      title: "عدم موجودی",
      description: `محصول «${name}» ناموجود شده است.`,
    };
  }

  if (
    product.low_stock_alert &&
    product.low_stock_threshold > 0 &&
    product.quantity <= product.low_stock_threshold
  ) {
    return {
      ...base,
      kind: "urgent_purchase",
      severity: "critical",
      title: "نیاز به خرید فوری",
      description: `موجودی «${name}» به حد بحرانی خرید رسیده است.`,
      context: `${base.context} · حد هشدار: ${product.low_stock_threshold.toLocaleString("fa-IR")}`,
    };
  }

  if (product.status === "low_stock") {
    return {
      ...base,
      kind: "low_stock",
      severity: "warning",
      title: "کمبود موجودی",
      description: `موجودی «${name}» کمتر از حد مطلوب است.`,
      context: `${base.context} · حد هشدار: ${product.low_stock_threshold.toLocaleString("fa-IR")}`,
    };
  }

  return null;
}

export const notificationService = {
  deriveProfile(user: User | null | undefined): ProfileNotification[] {
    if (!user || user.is_system_admin || user.is_store_owner !== true) return [];
    const incomplete = [user.first_name, user.last_name, user.phone, user.email]
      .some((value) => !value?.trim());
    if (!incomplete) return [];
    return [{
      id: "profile-completion",
      kind: "profile_completion",
      severity: "info",
      title: "پروفایل شما کامل نیست",
      description: "نام، نام خانوادگی و راه‌های تماس را در پروفایل خود تکمیل کنید.",
      context: "این یادآوری مانع استفاده از برنامه نمی‌شود.",
      route: "/setting/profile",
    }];
  },
  deriveUpdate(update: AppUpdateSnapshot): UpdateNotification[] {
    if (!["ready", "deferred", "applying"].includes(update.status)) return [];
    return [{
      id: "app-update-ready",
      kind: "app_update_ready",
      severity: "info",
      title: "نسخه جدید تنظیم آماده است",
      description: update.release?.summary ?? "آخرین نسخه برنامه برای نصب روی این دستگاه آماده شده است.",
      context: update.release ? `نسخه ${update.release.version}` : "برای مشاهده جزئیات، بخش بروزرسانی را باز کنید.",
      route: "/setting/update",
    }];
  },
  derive(products: readonly Product[]): InventoryNotification[] {
    return products
      .map(deriveProductNotification)
      .filter((item): item is InventoryNotification => item !== null)
      .sort((left, right) => {
        if (left.severity !== right.severity) return left.severity === "critical" ? -1 : 1;
        return left.productName.localeCompare(right.productName, "fa");
      });
  },

  deriveBackup(status: BackupStatus): BackupNotification[] {
    const settings = status.settings;
    if (!status.hasRecoverableData) return [];

    const notifications: BackupNotification[] = [];
    if (settings?.lastFailure) {
      notifications.push({
        id: "backup-failed",
        kind: "backup_failed",
        severity: "critical",
        title: "ذخیره فایل پشتیبان ناموفق بود",
        description: "آخرین تلاش برای نوشتن فایل پشتیبان کامل نشد.",
        context: backupErrorMessage(new Error(settings.lastFailure)),
        route: "/setting/backup",
      });
    }

    if (!status.dirty) return notifications;
    if (!settings?.onboardingCompleted) {
      notifications.push({
        id: "backup-not-configured",
        kind: "backup_not_configured",
        severity: "warning",
        title: "فایل پشتیبان راه‌اندازی نشده است",
        description: "تغییرات قابل بازیابی این حساب هنوز در یک فایل محلی ذخیره نشده‌اند.",
        context: "برای انتخاب مقصد، تنظیمات فایل پشتیبان را باز کنید.",
        route: "/setting/backup",
      });
    } else if (settings.mode === "manual") {
      notifications.push({
        id: "backup-manual-required",
        kind: "backup_manual_required",
        severity: "warning",
        title: "ذخیره دستی فایل پشتیبان لازم است",
        description: "در این مرورگر، ذخیره خودکار فایل پشتیبان پشتیبانی نمی‌شود.",
        context: "برای دریافت نسخه تازه، ذخیره را به‌صورت دستی آغاز کنید.",
        route: "/setting/backup",
      });
    } else if (settings.permission !== "granted") {
      notifications.push({
        id: "backup-permission-required",
        kind: "backup_permission_required",
        severity: "warning",
        title: "دسترسی فایل پشتیبان نیاز به تأیید دارد",
        description: "مرورگر بدون اقدام مستقیم شما اجازه نوشتن در مقصد را نمی‌دهد.",
        context: "تنظیمات فایل پشتیبان را باز کنید و مقصد را دوباره متصل کنید.",
        route: "/setting/backup",
      });
    }
    return notifications;
  },
};
