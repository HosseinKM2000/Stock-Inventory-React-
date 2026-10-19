import { IMAGE_LIMITS, PASSTHROUGH_IMAGE_TYPES } from "./image.constants";
import type { ImageProcessOptions, ProcessedImage } from "./types";
import {
  ImageValidationError,
  validateOriginalImage,
  validateProcessedImage,
} from "./image.validation";

function fitInside(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    if (typeof createImageBitmap === "function") return await createImageBitmap(file);

    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("decode failed"));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Image decoding failed", error);
    throw new ImageValidationError("تصویر قابل خواندن نیست یا فایل خراب است.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new ImageValidationError("بهینه‌سازی تصویر ناموفق بود.")),
      type,
      quality,
    );
  });
}

function extensionFor(type: string) {
  if (type === "image/avif") return "avif";
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "webp";
}

export const imageProcessor = {
  async process(file: File, options: ImageProcessOptions): Promise<ProcessedImage> {
    const profile = IMAGE_LIMITS[options.purpose];
    validateOriginalImage(file, profile);

    const source = await decode(file);
    try {
      const size = fitInside(source.width, source.height, profile.maxWidth, profile.maxHeight);
      const alreadySized = size.width === source.width && size.height === source.height;
      const optimizedType = PASSTHROUGH_IMAGE_TYPES.includes(
        file.type as (typeof PASSTHROUGH_IMAGE_TYPES)[number],
      );

      if (alreadySized && optimizedType && file.size <= profile.maxOutputSize) {
        return {
          blob: file,
          extension: extensionFor(file.type),
          width: source.width,
          height: source.height,
        };
      }

      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new ImageValidationError("پردازش تصویر در این مرورگر پشتیبانی نمی‌شود.");
      context.drawImage(source, 0, 0, size.width, size.height);

      let quality = profile.quality;
      let blob = await toBlob(canvas, "image/webp", quality);
      while (blob.size > profile.maxOutputSize && quality - 0.06 >= profile.minQuality) {
        quality -= 0.06;
        blob = await toBlob(canvas, "image/webp", quality);
      }

      validateProcessedImage(blob, profile);
      return { blob, extension: "webp", width: size.width, height: size.height };
    } catch (error) {
      if (error instanceof ImageValidationError) throw error;
      console.error("Image processing failed", error);
      throw new ImageValidationError("پردازش تصویر ناموفق بود. دوباره تلاش کنید.");
    } finally {
      if ("close" in source) source.close();
    }
  },
};
