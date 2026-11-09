import { describe, expect, it } from "vitest";

import { getHeaderSectionTitle } from "@/features/app/layout/header-section-title";

describe("header section title", () => {
  it.each([
    ["/dashboard", "داشبورد"],
    ["/dashboard/products/low-stock", "داشبورد"],
    ["/inventory/list", "محصولات"],
    ["/inventory/edit", "محصولات"],
    ["/tools", "ابزارها"],
    ["/tools/scanner", "ابزارها"],
    ["/setting", "تنظیمات"],
    ["/setting/security", "تنظیمات"],
    ["/management/users", "مدیریت"],
    ["/industry", "حوزه کاری"],
  ])("maps %s to %s", (pathname, title) => {
    expect(getHeaderSectionTitle(pathname)).toBe(title);
  });

  it("uses dashboard as the safe fallback", () => {
    expect(getHeaderSectionTitle("/")).toBe("داشبورد");
  });
});
