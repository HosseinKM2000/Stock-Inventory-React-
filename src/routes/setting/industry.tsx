import IndustryForm from "@/features/setting/components/industry/industry-form";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Box } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { CubeIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export const Route = createFileRoute("/setting/industry")({ component: IndustryPage });

function IndustryPage() {
  return (
    <Box dir="rtl" className="settings-detail-workspace mx-auto w-full max-w-4xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="حوزه کاری" description="حوزه فعالیت حساب خود را انتخاب کنید تا کاتالوگ و امکانات مرتبط نمایش داده شوند. تغییر این گزینه نیازمند اینترنت است." icon={CubeIcon} helpTopic="account" />
      <OnlineGuard><IndustryForm mode="settings" /></OnlineGuard>
    </Box>
  );
}
