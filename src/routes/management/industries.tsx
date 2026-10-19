import Industries from "@/features/setting/components/industry";
import { ManagementPage } from "@/features/app/layout/management-page";
import { GearIcon } from "@radix-ui/react-icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/industries")({
  component: () => (
    <ManagementPage title="مدیریت حوزه‌ها" description="حوزه‌های قابل انتخاب کاربران و ابزارهای فعال هر حوزه را روی سرور مدیریت کنید." icon={GearIcon}>
      <Industries hideHeading />
    </ManagementPage>
  ),
});
