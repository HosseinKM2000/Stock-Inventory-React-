import { describe, expect, it } from "vitest";

import { getHeaderSectionTitle } from "@/features/app/layout/header-section-title";

describe("header section title", () => {
  it.each([
    ["/dashboard", "داشبورد"],
    ["/dashboard/products/low-stock", "داشبورد · کم‌موجود"],
    ["/inventory/list", "محصولات"],
    ["/inventory/edit", "محصولات · ویرایش محصول"],
    ["/tools", "ابزارها"],
    ["/tools/scanner", "ابزارها · اسکنر"],
    ["/tools/invoices", "ابزارها · فاکتورها"],
    ["/setting", "تنظیمات"],
    ["/setting/security", "تنظیمات · امنیت"],
    ["/setting/subscription", "تنظیمات · اشتراک من"],
    ["/setting/subscription/?source=header", "تنظیمات · اشتراک من"],
    ["/management/users", "مدیریت · کاربران"],
    ["/industry", "حوزه کاری"],
  ])("maps %s to %s", (pathname, title) => {
    expect(getHeaderSectionTitle(pathname)).toBe(title);
  });

  it("uses dashboard as the safe fallback", () => {
    expect(getHeaderSectionTitle("/")).toBe("داشبورد");
  });
});
