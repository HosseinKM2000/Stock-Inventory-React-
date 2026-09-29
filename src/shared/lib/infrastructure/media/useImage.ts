import { useEffect, useRef, useState } from "react";
import { resolveAssetUrl } from "@/shared/api/client";
import { imageService, isLocalImage } from "./image.service";

type ImageResult = {
  path: string;
  src?: string;
  error?: Error;
};

export function useResolvedImage(path?: string | null) {
  const [result, setResult] = useState<ImageResult>();
  const currentPathRef = useRef<string | null>(null);
  const normalizedPath = path ?? null;

  useEffect(() => {
    currentPathRef.current = normalizedPath;
    if (!normalizedPath || !isLocalImage(normalizedPath)) return;

    let cancelled = false;
    let objectUrl: string | undefined;

    imageService
      .read(normalizedPath)
      .then((file) => {
        if (cancelled || currentPathRef.current !== normalizedPath) return;
        try {
          objectUrl = URL.createObjectURL(file);
          setResult({ path: normalizedPath, src: objectUrl });
        } catch (error) {
          throw error instanceof Error ? error : new Error("Object URL creation failed");
        }
      })
      .catch((error: unknown) => {
        if (cancelled || currentPathRef.current !== normalizedPath) return;
        const technicalError = error instanceof Error ? error : new Error("Local image read failed");
        console.error("Local image could not be resolved", technicalError);
        setResult({ path: normalizedPath, error: technicalError });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [normalizedPath]);

  if (!normalizedPath) return { src: undefined, loading: false, error: undefined };
  if (!isLocalImage(normalizedPath)) {
    return { src: resolveAssetUrl(normalizedPath), loading: false, error: undefined };
  }

  const current = result?.path === normalizedPath ? result : undefined;
  return {
    src: current?.src,
    loading: !current,
    error: current?.error,
  };
}

export function useImage(path?: string | null) {
  return useResolvedImage(path).src;
}
