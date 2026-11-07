import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

const mutations = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("@/features/setting/mutations/use-industry", () => ({
  useIndustries: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useSetIndustry: () => ({
    mutate: mutations.mutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

import IndustryForm from "@/features/setting/components/industry/industry-form";

describe("IndustryForm presentation", () => {
  it("keeps the skip action in onboarding", () => {
    render(<Theme><IndustryForm /></Theme>);

    expect(screen.getByRole("heading", { name: "حوزه کاری مجموعه" })).toBeVisible();
    expect(screen.getByRole("link", { name: "فعلاً رد کردن" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: "ذخیره و ادامه" })).toBeVisible();
  });

  it("uses a save-only presentation in settings", () => {
    render(<Theme><IndustryForm mode="settings" /></Theme>);

    expect(screen.getByRole("heading", { name: "تغییر حوزه کاری" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "فعلاً رد کردن" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ذخیره تغییرات" })).toBeVisible();
  });
});
