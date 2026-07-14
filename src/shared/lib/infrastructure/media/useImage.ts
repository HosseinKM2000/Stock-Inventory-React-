import { useEffect, useRef, useState } from "react";
import { imageService } from "./image.service";

export function useImage(path?: string | null) {
  const [result, setResult] = useState<{ path: string; src: string }>();
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    const normalizedPath = path ?? null;
    currentPathRef.current = normalizedPath;

    if (!normalizedPath) {
      // nothing to load — render derives "no src" on its own, no setState needed
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;

    imageService
      .read(normalizedPath)
      .then((file) => {
        if (cancelled || currentPathRef.current !== normalizedPath) return;
        objectUrl = URL.createObjectURL(file);
        setResult({ path: normalizedPath, src: objectUrl });
      })
      .catch(() => {
        // load failed — render already falls back to undefined below
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  // Only trust the cached result if it matches the currently requested path.
  // This is what makes the reset "automatic" instead of an explicit setState.
  const normalizedPath = path ?? null;
  return result?.path === normalizedPath ? result.src : undefined;
}
