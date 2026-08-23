import { imageProcessor } from "./image-processor";
import { imageRepository } from "./image.repository";
import type { ImageProcessOptions } from "./types";
import { storageQuotaService } from "../storage/storage-quota.service";

export const LOCAL_IMAGE_PREFIX = "local://";

export function isLocalImage(path?: string | null): path is string {
  return typeof path === "string" && path.startsWith(LOCAL_IMAGE_PREFIX);
}

export const imageService = {
  async save(file: File, options?: ImageProcessOptions) {
    const processed = await imageProcessor.process(file, options);

    await storageQuotaService.ensureAvailable(processed.blob.size);

    const id = crypto.randomUUID();

    return imageRepository.save(id, processed.blob, processed.extension);
  },

  async read(path: string) {
    return imageRepository.read(path);
  },

  async remove(path: string | null | undefined) {
    if (!isLocalImage(path)) return;

    try {
      await imageRepository.remove(path);
    } catch (error) {
      // already missing — nothing to clean up
      if (!(error instanceof DOMException && error.name === "NotFoundError")) {
        throw error;
      }
    }
  },

  async exists(path: string | null | undefined) {
    if (!isLocalImage(path)) return false;

    return imageRepository.exists(path);
  },

  /**
   * Deletes local image files that are no longer referenced by any record.
   * Returns the paths that were removed.
   */
  async removeOrphans(referenced: Iterable<string | null | undefined>) {
    const keep = new Set<string>();

    for (const path of referenced) {
      if (isLocalImage(path)) keep.add(path);
    }

    const stored = await imageRepository.list();

    const orphans = stored.filter((path) => !keep.has(path));

    for (const path of orphans) {
      await this.remove(path);
    }

    return orphans;
  },
};
