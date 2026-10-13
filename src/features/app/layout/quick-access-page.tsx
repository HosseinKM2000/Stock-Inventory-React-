import { useAuth } from "@/shared/auth/use-auth";
import { Link } from "@tanstack/react-router";
import { Box, Flex, Text } from "@radix-ui/themes";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import {
  visibleNavigationItems,
  type NavigationItem,
} from "./navigation-items";

type Props = {
  title: string;
  description: string;
  items: readonly NavigationItem[];
  footer?: ReactNode;
};

export function QuickAccessPage({ title, description, items, footer }: Props) {
  const { user } = useAuth();
  const visibleItems = visibleNavigationItems(items, user);

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-3xl">
      <Box mb="6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <Text as="p" size="2" color="gray" mt="2" className="max-w-2xl leading-6">
          {description}
        </Text>
      </Box>

      <nav aria-label={title} className="quick-access-menu mx-auto max-w-xl overflow-hidden rounded-2xl border">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className="quick-access-menu-item group flex min-h-17 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-[var(--accent-a2)] focus-visible:bg-[var(--accent-a3)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-8)] sm:px-5"
            >
              <Flex align="center" justify="center" className="h-10 w-10 shrink-0 rounded-xl bg-[var(--accent-a3)] text-[var(--accent-11)]" aria-hidden="true">
                <Icon width="20" height="20" />
              </Flex>
              <Text as="div" size="3" weight="bold" className="min-w-0 flex-1">
                {item.label}
              </Text>
              <ChevronLeftIcon className="shrink-0 text-foreground/45 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      {footer && <Box mt="5" className="mx-auto max-w-xl">{footer}</Box>}
    </Box>
  );
}
