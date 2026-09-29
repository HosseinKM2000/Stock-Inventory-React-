import { ALLOWED_IMAGE_TYPES } from "./image.constants";
import type { ImageProcessingProfile } from "./types";

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function megabytes(bytes: number) {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(
    bytes / (1024 * 1024),
  );
}

export function validateOriginalImage(file: File, profile: ImageProcessingProfile) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new ImageValidationError("فرمت تصویر پشتیبانی نمی‌شود. از JPEG، PNG، WebP یا AVIF استفاده کنید.");
  }

  if (file.size <= 0) {
    throw new ImageValidationError("فایل تصویر خالی یا خراب است.");
  }

  if (file.size > profile.maxInputSize) {
    throw new ImageValidationError(
      `حجم تصویر اصلی نباید بیشتر از ${megabytes(profile.maxInputSize)} مگابایت باشد.`,
    );
  }
}

export function validateProcessedImage(blob: Blob, profile: ImageProcessingProfile) {
  if (blob.size <= 0) {
    throw new ImageValidationError("پردازش تصویر نتیجه معتبری ایجاد نکرد.");
  }

  if (blob.size > profile.maxOutputSize) {
    throw new ImageValidationError("تصویر پس از بهینه‌سازی همچنان بیش از حد بزرگ است. تصویر دیگری انتخاب کنید.");
  }
}
