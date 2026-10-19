import { useEffect, useRef, useState } from "react";
import { apiFetch, resolveAssetUrl } from "@/shared/api/client";
import { imageService } from "./image.service";

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
    const localImage = normalizedPath?.startsWith("local://") === true;
    if (!normalizedPath || (!localImage && !normalizedPath.startsWith("/uploads/"))) return;

    let cancelled = false;
    let objectUrl: string | undefined;

    const filePromise = localImage
      ? imageService.read(normalizedPath)
      : apiFetch<Blob>(`/files/${encodeURIComponent(normalizedPath.split("/").at(-1) ?? "")}`, { responseType: "blob" });
    filePromise
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
  const localImage = normalizedPath.startsWith("local://");
  if (!localImage && !normalizedPath.startsWith("/uploads/")) {
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
