export type LocalImage = {
  id: string;
  path: string;
};

export type ImageProcessOptions = {
  maxWidth?: number;

  maxHeight?: number;

  quality?: number;
};

export type ProcessedImage = {
  blob: Blob;

  extension: string;

  width: number;

  height: number;
};

export const IMAGE_CONSTRAINTS = {
  maxBytes: 10 * 1024 * 1024,

  allowedTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ],
} as const;
