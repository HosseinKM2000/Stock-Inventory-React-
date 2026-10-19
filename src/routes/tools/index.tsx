import { QuickAccessPage } from "@/features/app/layout/quick-access-page";
import { toolsNavigationItems } from "@/features/app/layout/navigation-items";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tools/")({ component: ToolsAccessPage });

function ToolsAccessPage() {
  return (
    <QuickAccessPage
      title="ابزارها"
      description="ابزارهای عملیاتی موجودی، خروجی و بازیابی داده را بدون آمیختن با تنظیمات حساب در دسترس دارید."
      items={toolsNavigationItems}
    />
  );
}
