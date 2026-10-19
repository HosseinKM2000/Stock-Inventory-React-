import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { NotificationItem } from "@/features/notifications/components/notification-item";
import type { AppNotification } from "@/features/notifications/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <a href="#notification" onClick={onClick}>{children}</a>,
}));

const criticalNotification: AppNotification = {
  id: "inventory-alert-7",
  productId: 7,
  productName: "برنج",
  kind: "out_of_stock",
  severity: "critical",
  title: "عدم موجودی",
  description: "محصول برنج ناموجود شده است.",
  context: "موجودی فعلی: ۰",
};

describe("NotificationItem", () => {
  it("renders a responsive state card and keeps its navigation action", () => {
    const onNavigate = vi.fn();
    const { container } = render(<NotificationItem item={criticalNotification} onNavigate={onNavigate} />);

    const card = container.querySelector(".app-notification-card");
    expect(card).toHaveAttribute("data-severity", "critical");
    expect(screen.getByText("بحرانی")).toBeInTheDocument();
    expect(screen.getByText("محصول برنج ناموجود شده است.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "مشاهده و ویرایش محصول" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
