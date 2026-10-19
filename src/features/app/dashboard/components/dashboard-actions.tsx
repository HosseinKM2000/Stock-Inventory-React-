import { Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

import { useDashboardAnalysis } from "../mutations/use-dashboard";

export function DashboardActions() {
  const { data, isLoading, isError } = useDashboardAnalysis();
  const hasActions = Boolean(data?.actions.sync || data?.actions.inventory.length);

  return (
    <Flex direction="column" gap="4" className="app-responsive-page p-4" dir="rtl">
      <div>
        <Text as="div" role="heading" aria-level={1} size="6" weight="bold">اقدام‌های امروز</Text>
        <Text as="p" size="2" color="gray" mt="1">کارهایی که با وضعیت فعلی اطلاعات نیاز به رسیدگی دارند.</Text>
      </div>
      {isLoading && <Flex justify="center" py="9"><Spinner /></Flex>}
      {isError && <Callout.Root color="red"><Callout.Text>خواندن اطلاعات محلی ممکن نبود.</Callout.Text></Callout.Root>}
      {!isLoading && !isError && !hasActions && (
        <Flex justify="center" py="9"><Text color="gray">اقدام معوقی وجود ندارد.</Text></Flex>
      )}
      {data?.actions.sync && (
        <section aria-labelledby="sync-actions-heading">
          <Text id="sync-actions-heading" as="div" role="heading" aria-level={2} size="3" weight="bold" mb="2">همگام‌سازی</Text>
          <Link to={data.actions.sync.to} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
            <Card className="border-red-6 transition-colors hover:bg-[var(--red-a2)]">
              <Flex justify="between" gap="4">
                <Text>بررسی خطاها یا تعارض‌های همگام‌سازی</Text>
                <Text weight="bold">{data.actions.sync.count.toLocaleString("fa-IR")}</Text>
              </Flex>
            </Card>
          </Link>
        </section>
      )}
      {data && data.actions.inventory.length > 0 && (
        <section aria-labelledby="inventory-actions-heading">
          <Text id="inventory-actions-heading" as="div" role="heading" aria-level={2} size="3" weight="bold" mb="2">موجودی و اطلاعات محصول</Text>
          <Flex direction="column" gap="3">
            {data.actions.inventory.map((action) => (
              <Link key={action.kind} to={action.to} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
                <Card className="transition-colors hover:bg-[var(--accent-a2)]">
                  <Flex justify="between" gap="4">
                    <Text>{action.title}</Text>
                    <Text weight="bold">{action.count.toLocaleString("fa-IR")}</Text>
                  </Flex>
                </Card>
              </Link>
            ))}
          </Flex>
        </section>
      )}
    </Flex>
  );
}
