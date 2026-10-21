import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  capacity: vi.fn(),
  roles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));

vi.mock("@/features/app/layout/page-guide", () => ({
  PageGuide: ({ section, title }: { section: string; title: string }) => (
    <header>
      <nav aria-label="مسیر صفحه">{section}</nav>
      <h1>{title}</h1>
    </header>
  ),
}));

vi.mock("@/shared/access/online-guard", () => ({
  OnlineGuard: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock("@/features/personnel/api", () => ({
  personnelKeys: {
    roles: ["store-roles"],
    capacity: ["personnel-capacity"],
  },
  personnelApi: api,
  permissionOptions: [
    ["products.view", "مشاهده محصولات"], ["products.create", "ایجاد محصول"], ["products.edit", "ویرایش جزئیات محصول"],
    ["products.quantity.change", "تغییر موجودی"], ["products.sale_price.view", "مشاهده قیمت فروش"], ["products.sale_price.change", "تغییر قیمت فروش"],
    ["products.purchase_price.view", "مشاهده قیمت خرید"], ["products.purchase_price.change", "تغییر قیمت خرید"], ["finance.view", "مشاهده تحلیل مالی"], ["products.delete", "حذف محصول"],
    ["categories.manage", "مدیریت دسته‌ها"], ["labels.manage", "مدیریت برچسب‌ها"], ["products.bulk", "عملیات گروهی"],
    ["barcodes.lookup", "مشاهده و اسکن بارکد"], ["barcodes.manage", "مدیریت بارکد"], ["labels.print", "چاپ لیبل"],
    ["dashboard.view", "مشاهده داشبورد"], ["tools.import", "ورود اطلاعات"], ["tools.export", "خروجی"],
    ["tools.catalog", "کاتالوگ"], ["tools.backup", "پشتیبان‌گیری"], ["tools.restore", "بازیابی"],
  ],
}));

import { RolesPage } from "@/features/personnel/roles-page";

const roles = [
  { id: 2, name: "مشاهده‌گر", permissions: ["products.view"], assigned_count: 1 },
  { id: 3, name: "انباردار", permissions: ["products.view", "products.quantity.change"], assigned_count: 0 },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Theme><RolesPage /></Theme>
    </QueryClientProvider>,
  );
}

describe("roles page", () => {
  beforeEach(() => {
    api.capacity.mockResolvedValue({ enabled: true, used: 1, limit: 4, available: 3 });
    api.roles.mockResolvedValue(roles);
    api.createRole.mockResolvedValue({ id: 4, name: "فروشنده", permissions: ["products.view"], assigned_count: 0 });
    api.updateRole.mockResolvedValue(roles[1]);
    api.deleteRole.mockResolvedValue(undefined);
  });

  it("keeps page guidance and renders grouped permissions and role summaries", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "نقش‌های مجموعه", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "مسیر صفحه" })).toHaveTextContent("تنظیمات");
    expect(await screen.findByRole("heading", { name: "نقش تازه" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "مدیریت محصولات" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "سایر دسترسی‌ها" })).toBeInTheDocument();
    expect(await screen.findByText("مشاهده‌گر")).toBeInTheDocument();
    expect(screen.getByText("۲ نقش")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /حذف مشاهده‌گر؛ ابتدا اعضای نقش را جابه‌جا کنید/ })).toBeDisabled();
  });

  it("creates a role with the selected permissions", async () => {
    renderPage();

    fireEvent.change(await screen.findByRole("textbox", { name: /نام نقش/ }), { target: { value: "فروشنده" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "مشاهده محصولات" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره نقش" }));

    await waitFor(() => expect(api.createRole).toHaveBeenCalledWith({
      name: "فروشنده",
      permissions: ["products.view"],
    }));
  });

  it("loads an existing role into the editor", async () => {
    renderPage();

    const editButtons = await screen.findAllByRole("button", { name: "ویرایش" });
    fireEvent.click(editButtons[1]);

    expect(screen.getByRole("heading", { name: "ویرایش نقش" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /نام نقش/ })).toHaveValue("انباردار");
    expect(screen.getByRole("checkbox", { name: "تغییر موجودی" })).toBeChecked();
    expect(screen.getByRole("button", { name: "ذخیره تغییرات" })).toBeEnabled();
  });
});
