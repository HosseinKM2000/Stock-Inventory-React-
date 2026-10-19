import { QuickAccessPage } from "@/features/app/layout/quick-access-page";
import { managementNavigationItems } from "@/features/app/layout/navigation-items";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/")({ component: ManagementAccessPage });

function ManagementAccessPage() {
  return (
    <QuickAccessPage
      title="مدیریت"
      description="عملیات مدیریتی سرور برای کاربران، اشتراک‌ها، کاتالوگ و حوزه‌های کاری."
      items={managementNavigationItems}
    />
  );
}
