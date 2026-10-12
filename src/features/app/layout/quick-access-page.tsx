import { useAuth } from "@/shared/auth/use-auth";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Link } from "@tanstack/react-router";
import { Badge, Box, Flex, Text } from "@radix-ui/themes";
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
  const online = useOnline();
  const visibleItems = visibleNavigationItems(items, user);

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-3xl">
      <Box mb="6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <Text as="p" size="2" color="gray" mt="2" className="max-w-2xl leading-6">
          {description}
        </Text>
      </Box>

      <nav aria-label={title} className="overflow-hidden rounded-2xl border border-foreground/10 bg-background">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`group flex min-h-20 items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-[var(--accent-a2)] focus-visible:bg-[var(--accent-a3)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-8)] sm:px-5 ${index > 0 ? "border-t border-foreground/10" : ""}`}
            >
              <Flex align="center" justify="center" className="h-11 w-11 shrink-0 rounded-xl bg-[var(--accent-a3)] text-[var(--accent-11)]" aria-hidden="true">
                <Icon width="21" height="21" />
              </Flex>
              <Box className="min-w-0 flex-1">
                <Flex align="center" gap="2" wrap="wrap">
                  <Text as="div" size="3" weight="bold">{item.label}</Text>
                  {item.requiresOnline && !online && (
                    <Badge color="amber" variant="soft">نیازمند اینترنت</Badge>
                  )}
                </Flex>
                {item.description && (
                  <Text as="div" size="2" color="gray" mt="1" className="leading-5">
                    {item.description}
                  </Text>
                )}
              </Box>
              <ChevronLeftIcon className="shrink-0 text-foreground/45 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      {footer && <Box mt="5">{footer}</Box>}
    </Box>
  );
}
