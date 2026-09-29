import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryFileHandle {
  private readonly name: string;
  private readonly files: Map<string, Blob>;
  constructor(name: string, files: Map<string, Blob>) {
    this.name = name;
    this.files = files;
  }
  async getFile() {
    const blob = this.files.get(this.name);
    if (!blob) throw new DOMException("Missing", "NotFoundError");
    return new File([blob], this.name, { type: blob.type });
  }
  async createWritable() {
    let pending: Blob | null = null;
    return {
      write: async (blob: Blob) => { pending = blob; },
      close: async () => { if (pending) this.files.set(this.name, pending); },
      abort: async () => { pending = null; },
    };
  }
}

class MemoryDirectory {
  readonly files = new Map<string, Blob>();
  async getDirectoryHandle() { return this; }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!options?.create && !this.files.has(name)) throw new DOMException("Missing", "NotFoundError");
    return new MemoryFileHandle(name, this.files);
  }
  async removeEntry(name: string) {
    if (!this.files.delete(name)) throw new DOMException("Missing", "NotFoundError");
  }
  async *keys() { yield* this.files.keys(); }
}

describe("OPFS image repository", () => {
  const root = new MemoryDirectory();

  beforeEach(() => {
    root.files.clear();
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { getDirectory: vi.fn().mockResolvedValue(root) },
    });
  });

  it("saves a file reference, reads a Blob-compatible file, lists and removes it", async () => {
    const { imageRepository } = await import("@/shared/lib/infrastructure/media/image.repository");
    const path = await imageRepository.save("product-1", new Blob(["pixels"], { type: "image/webp" }));
    expect(path).toBe("local://product-1.webp");
    expect(await (await imageRepository.read(path)).text()).toBe("pixels");
    expect(await imageRepository.list()).toEqual([path]);
    expect(await imageRepository.exists(path)).toBe(true);
    await imageRepository.remove(path);
    expect(await imageRepository.exists(path)).toBe(false);
  });

  it("cleans incomplete files when a write fails", async () => {
    const { imageRepository } = await import("@/shared/lib/infrastructure/media/image.repository");
    vi.spyOn(root, "getFileHandle").mockResolvedValueOnce({
      createWritable: async () => ({
        write: async () => { throw new Error("quota exceeded"); },
        close: async () => undefined,
        abort: async () => undefined,
      }),
    } as never);
    await expect(imageRepository.save("broken", new Blob(["x"]))).rejects.toThrow("quota exceeded");
    expect(await imageRepository.list()).toEqual([]);
  });
});
