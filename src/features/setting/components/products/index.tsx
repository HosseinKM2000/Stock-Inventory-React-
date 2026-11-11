import { useRefreshProductsFromServer } from "@/features/setting/mutations/use-product-refresh";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Button } from "@/shared/ui/button/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { PageGuide } from "@/features/app/layout/page-guide";

export default function ProductSettings() {
  const online = useOnline();
  const refresh = useRefreshProductsFromServer();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Box className="space-y-5" dir="rtl">
      <PageGuide section="ابزارها" sectionTo="/tools" title="بازیابی" description="کارهای در انتظار را بررسی کنید و تازه‌ترین اطلاعات تأییدشده مجموعه را دوباره دریافت کنید." icon={ReloadIcon} helpTopic="recovery" />

      {!online && (
        <Callout.Root color="amber">
          <Callout.Text>
            برای دریافت آخرین اطلاعات از سرور، اتصال اینترنت لازم است.
          </Callout.Text>
        </Callout.Root>
      )}

      <Card className="max-w-2xl">
        <Flex
          direction={{ initial: "column", sm: "row" }}
          justify="between"
          align={{ initial: "stretch", sm: "center" }}
          gap="4"
        >
          <Box>
            <Text as="div" size="4" weight="bold">به‌روزرسانی محصولات از سرور</Text>
            <Text as="div" size="2" color="gray" mt="2">
              ابتدا کارهای در انتظار بررسی می‌شوند و سپس تازه‌ترین اطلاعات تأییدشده مجموعه دریافت می‌شود. تا پایان این کار صفحه را نبندید.
            </Text>
          </Box>
          <Button
            className="min-h-11 shrink-0"
            disabled={!online}
            loading={refresh.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <ReloadIcon />
            تازه‌سازی اطلاعات
          </Button>
        </Flex>
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="محصولات تازه‌سازی شوند؟"
        description="کارهای در انتظار بررسی می‌شوند و تازه‌ترین اطلاعات تأییدشده مجموعه دریافت می‌شود. تا پایان این کار صفحه را نبندید."
        confirmLabel="تازه‌سازی"
        variant="warning"
        loading={refresh.isPending}
        onConfirm={() =>
          refresh.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })
        }
      />
    </Box>
  );
}
