import { catalogVisibilityService } from "@/features/app/inventory/services/catalog-visibility.service";
import { Link } from "@tanstack/react-router";
import { Box, Button, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useState } from "react";
import { ClipboardIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export function CatalogPreferences() {
  const [hidden, setHidden] = useState(() => catalogVisibilityService.isHidden());

  const updateVisibility = (nextHidden: boolean) => {
    catalogVisibilityService.setHidden(nextHidden);
    setHidden(nextHidden);
  };

  return (
    <Box dir="rtl" className="mx-auto max-w-3xl space-y-5">
      <PageGuide section="ابزارها" sectionTo="/tools" title="کاتالوگ" description="محصولات کاتالوگی که قبلاً در داده محلی شما دریافت شده‌اند، همراه موجودی نمایش داده می‌شوند." icon={ClipboardIcon} />
      <Card size="3">
        <Flex align={{ initial: "start", sm: "center" }} justify="between" gap="4" direction={{ initial: "column", sm: "row" }}>
          <Box>
            <Text as="div" size="3" weight="bold">نمایش محصولات کاتالوگی</Text>
            <Text as="div" size="2" color="gray" mt="1">
              این انتخاب فقط نحوه نمایش داده محلی را تغییر می‌دهد و محصولی را حذف نمی‌کند.
            </Text>
          </Box>
          <Switch
            size="3"
            checked={!hidden}
            onCheckedChange={(checked) => updateVisibility(!checked)}
            aria-label="نمایش محصولات کاتالوگی"
          />
        </Flex>
      </Card>
      <Button asChild variant="soft">
        <Link to="/inventory/list">مشاهده موجودی</Link>
      </Button>
    </Box>
  );
}
