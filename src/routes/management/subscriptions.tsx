import SubscriptionManagement from "@/features/setting/components/subscription-management";
import { ManagementPage } from "@/features/app/layout/management-page";
import { StarIcon } from "@radix-ui/react-icons";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/subscriptions")({
  component: () => (
    <ManagementPage title="مدیریت اشتراک‌ها" description="طرح‌ها، قیمت‌ها و قابلیت‌های اشتراک را مدیریت کنید؛ تغییر قابلیت‌ها فوراً در مجوزهای سرور اعمال می‌شود." icon={StarIcon}>
      <SubscriptionManagement hideHeading />
    </ManagementPage>
  ),
});
