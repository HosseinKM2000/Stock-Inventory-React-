import UsersSettings from "@/features/setting/components/users";
import { ManagementPage } from "@/features/app/layout/management-page";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/users")({
  component: () => (
    <ManagementPage title="کاربران" description="حساب‌ها، نقش مدیریتی، وضعیت دسترسی و اشتراک کاربران را مدیریت کنید؛ تغییرات مستقیماً روی سرور اعمال می‌شوند." icon={LockClosedIcon}>
      <UsersSettings hideHeading />
    </ManagementPage>
  ),
});
