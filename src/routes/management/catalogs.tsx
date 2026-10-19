import Catalogs from "@/features/setting/components/catalogs";
import { ManagementPage } from "@/features/app/layout/management-page";
import { ClipboardIcon } from "@radix-ui/react-icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/catalogs")({
  component: () => (
    <ManagementPage title="مدیریت کاتالوگ" description="محصولات مشترک حوزه‌های کاری را ایجاد، ویرایش، بایگانی یا بازیابی کنید." icon={ClipboardIcon}>
      <Catalogs hideHeading />
    </ManagementPage>
  ),
});
