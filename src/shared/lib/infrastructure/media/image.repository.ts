const ROOT = "inventory-images";

async function getRoot() {
  const root = await navigator.storage.getDirectory();

  return root.getDirectoryHandle(ROOT, {
    create: true,
  });
}

export const imageRepository = {
  async save(id: string, file: Blob) {
    const dir = await getRoot();

    const handle = await dir.getFileHandle(`${id}.webp`, {
      create: true,
    });

    const writable = await handle.createWritable();

    await writable.write(file);

    await writable.close();

    return `local://${id}.webp`;
  },

  async read(path: string) {
    const id = path.replace("local://", "");

    const dir = await getRoot();

    const handle = await dir.getFileHandle(id);

    const file = await handle.getFile();

    return file;
  },

  async remove(path: string) {
    const id = path.replace("local://", "");

    const dir = await getRoot();

    await dir.removeEntry(id);
  },

  async exists(path: string) {
    try {
      await this.read(path);

      return true;
    } catch {
      return false;
    }
  },
};
