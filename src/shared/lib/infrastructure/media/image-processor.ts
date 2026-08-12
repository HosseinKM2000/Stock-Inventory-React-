import {
  IMAGE_CONSTRAINTS,
  type ImageProcessOptions,
  type ProcessedImage,
} from "./types";

const DEFAULTS: Required<ImageProcessOptions> = {
  maxWidth: 1280,

  maxHeight: 1280,

  quality: 0.82,
};

export class ImageValidationError extends Error {}

export function validateImageFile(file: File) {
  if (!IMAGE_CONSTRAINTS.allowedTypes.includes(file.type as never)) {
    throw new ImageValidationError("فرمت تصویر پشتیبانی نمی شود");
  }

  if (file.size > IMAGE_CONSTRAINTS.maxBytes) {
    throw new ImageValidationError("حجم تصویر بیش از حد مجاز است");
  }
}

function supportsType(type: string) {
  if (typeof document === "undefined") return false;

  const canvas = document.createElement("canvas");

  return canvas.toDataURL(type).startsWith(`data:${type}`);
}

function fitInside(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function decode(file: File) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);

      image.onerror = () => reject(new ImageValidationError("تصویر نامعتبر است"));

      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new ImageValidationError("پردازش تصویر ناموفق بود"));
      },
      type,
      quality,
    );
  });
}

export const imageProcessor = {
  async process(
    file: File,
    options: ImageProcessOptions = {},
  ): Promise<ProcessedImage> {
    validateImageFile(file);

    const { maxWidth, maxHeight, quality } = { ...DEFAULTS, ...options };

    const source = await decode(file);

    const size = fitInside(
      source.width,
      source.height,
      maxWidth,
      maxHeight,
    );

    const canvas = document.createElement("canvas");

    canvas.width = size.width;

    canvas.height = size.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new ImageValidationError("پردازش تصویر پشتیبانی نمی شود");
    }

    context.drawImage(source, 0, 0, size.width, size.height);

    if ("close" in source) {
      source.close();
    }

    const type = supportsType("image/webp") ? "image/webp" : "image/jpeg";

    const blob = await toBlob(canvas, type, quality);

    const optimized =
      blob.size < file.size
        ? blob
        : file.type === type
          ? file
          : blob;

    return {
      blob: optimized,

      extension: type === "image/webp" ? "webp" : "jpg",

      width: size.width,

      height: size.height,
    };
  },
};
