import { imageRepository } from "./image.repository";

export const imageService = {
  async save(file: File) {
    const id = crypto.randomUUID();

    return imageRepository.save(id, file);
  },

  async read(path: string) {
    return imageRepository.read(path);
  },

  async remove(path: string | null | undefined) {
    if (!path) return;

    if (!path.startsWith("local://")) return;

    await imageRepository.remove(path);
  },
};
