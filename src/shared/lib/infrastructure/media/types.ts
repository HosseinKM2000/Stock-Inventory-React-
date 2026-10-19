export type ImagePurpose = "product" | "profile";

export type ImageProcessOptions = {
  purpose: ImagePurpose;
};

export type ImageProcessingProfile = {
  maxInputSize: number;
  maxOutputSize: number;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  minQuality: number;
};

export type ProcessedImage = {
  blob: Blob;

  extension: string;

  width: number;

  height: number;
};
