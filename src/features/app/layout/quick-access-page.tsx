import { useAuth } from "@/shared/auth/use-auth";
import { Link } from "@tanstack/react-router";
import { Box, Text } from "@radix-ui/themes";
import { ChevronLeftIcon, GlobeIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import type { ComponentType } from "react";
import { PageGuide } from "./page-guide";

import {
  visibleNavigationItems,
  type NavigationItem,
} from "./navigation-items";

type Props = {
  title: string;
  description: string;
  items: readonly NavigationItem[];
  icon?: ComponentType<{ width?: number | string; height?: number | string }>;
  sectionTo?: "/setting" | "/tools" | "/management";
  footer?: ReactNode;
};

export function QuickAccessPage({ title, description, items, icon, sectionTo, footer }: Props) {
  useEntitlementAccess();
  const { user } = useAuth();
  const visibleItems = visibleNavigationItems(items, user);
  const guidedSection = title === "تنظیمات" || title === "ابزارها" || title === "مدیریت" ? title : null;

  return (
    <Box dir="rtl" className="quick-access-page mx-auto w-full max-w-5xl">
      {guidedSection && icon && sectionTo ? (
        <PageGuide section={guidedSection} sectionTo={sectionTo} title={title} description={description} icon={icon} />
      ) : (
        <Box mb="5">
          <h1 className="text-2xl font-bold">{title}</h1>
          <Text as="p" size="2" color="gray" mt="2" className="max-w-2xl leading-6">{description}</Text>
        </Box>
      )}

      <nav aria-label={title} className="quick-access-menu mt-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className="quick-access-menu-item group outline-none"
            >
              <span className="quick-access-item-icon" aria-hidden="true">
                <Icon width="18" height="18" />
              </span>
              <span className="quick-access-item-copy">
                <Text as="span" size="3" weight="bold" className="quick-access-item-title">{item.label}</Text>
                {item.description ? <Text as="span" size="2" color="gray" className="quick-access-item-description">{item.description}</Text> : null}
              </span>
              <span className="quick-access-item-side">
                {item.requiresOnline ? <span className="quick-access-online"><GlobeIcon width="13" height="13" /> آنلاین</span> : <span className="quick-access-local">روی دستگاه</span>}
                <ChevronLeftIcon className="quick-access-arrow" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </nav>
      {footer && <Box mt="5" className="quick-access-footer">{footer}</Box>}
    </Box>
  );
}
