const ROOT = "inventory-images";

async function getRoot() {
  const root = await navigator.storage.getDirectory();

  return root.getDirectoryHandle(ROOT, {
    create: true,
  });
}

export const imageRepository = {
  async save(id: string, file: Blob, extension = "webp") {
    const dir = await getRoot();

    const name = `${id}.${extension}`;

    const handle = await dir.getFileHandle(name, {
      create: true,
    });

    const writable = await handle.createWritable();

    await writable.write(file);

    await writable.close();

    return `local://${name}`;
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

  async list(): Promise<string[]> {
    const dir = await getRoot();

    const names: string[] = [];

    for await (const name of dir.keys()) {
      names.push(`local://${name}`);
    }

    return names;
  },
};
