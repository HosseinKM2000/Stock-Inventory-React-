import { useRefreshProductsFromServer } from "@/features/setting/mutations/use-product-refresh";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Button } from "@/shared/ui/button/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Text } from "@radix-ui/themes";

export default function ProductSettings() {
  const online = useOnline();
  const refresh = useRefreshProductsFromServer();

  return (
    <Box className="space-y-5" dir="rtl">
      <Box>
        <Text as="div" size="6" weight="bold">محصولات</Text>
        <Text as="div" size="2" color="gray" mt="1">
          نگهداری و بازیابی نسخه محلی محصولات
        </Text>
      </Box>

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
              ابتدا تغییرات محلی همگام می‌شوند و سپس نسخه معتبر محصولات و اطلاعات
              کاتالوگ از سرور با IndexedDB تطبیق داده می‌شود.
            </Text>
          </Box>
          <Button
            className="min-h-11 shrink-0"
            disabled={!online}
            loading={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            <ReloadIcon />
            دریافت از سرور
          </Button>
        </Flex>
      </Card>
    </Box>
  );
}
