import type { ImagePurpose, ImageProcessingProfile } from "./types";

export const IMAGE_LIMITS: Record<ImagePurpose, ImageProcessingProfile> = {
  product: {
    maxInputSize: 12 * 1024 * 1024,
    maxOutputSize: 2.5 * 1024 * 1024,
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.84,
    minQuality: 0.7,
  },
  profile: {
    maxInputSize: 6 * 1024 * 1024,
    maxOutputSize: 700 * 1024,
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.86,
    minQuality: 0.74,
  },
};

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const PASSTHROUGH_IMAGE_TYPES = ["image/webp", "image/avif"] as const;
