import { imageService } from "./image.service";

const cache = new Map<string, string>();

export async function resolveImageUrl(path?: string | null) {
  if (!path) return undefined;

  if (!path.startsWith("local://")) {
    return path;
  }

  if (cache.has(path)) {
    return cache.get(path);
  }

  const file = await imageService.read(path);

  const url = URL.createObjectURL(file);

  cache.set(path, url);

  return url;
}
