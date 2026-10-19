import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/shared/lib/infrastructure/media/image.service", async (original) => {
  const actual = await original<typeof import("@/shared/lib/infrastructure/media/image.service")>();
  return { ...actual, imageService: { ...actual.imageService, read } };
});

import { useResolvedImage } from "@/shared/lib/infrastructure/media/useImage";

describe("local image URL lifecycle", () => {
  beforeEach(() => {
    read.mockClear();
    read.mockResolvedValue(new File(["pixels"], "one.webp", { type: "image/webp" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:one") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("reads OPFS references and revokes object URLs on replacement", async () => {
    const { result, rerender } = renderHook(({ path }) => useResolvedImage(path), {
      initialProps: { path: "local://one.webp" as string | null },
    });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.src).toBe("blob:one"));
    await act(async () => rerender({ path: null }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
  });

  it("uses remote asset URLs without reading OPFS", () => {
    const { result } = renderHook(() => useResolvedImage("https://cdn.test/image.webp"));
    expect(result.current.src).toBe("https://cdn.test/image.webp");
    expect(read).not.toHaveBeenCalled();
  });
});
