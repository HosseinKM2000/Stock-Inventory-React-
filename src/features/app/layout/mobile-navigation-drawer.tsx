import { settingsNavItems } from "@/features/setting/data/settings-items";
import { isAdmin } from "@/shared/access/authorization";
import { useAuth } from "@/shared/auth/use-auth";
import { useProfileMedia } from "@/shared/profile-media/use-profile-media";
import { isPathActive } from "@/shared/lib/navigation/is-path-active";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";
import { Avatar, Box, Flex, IconButton, Separator, Text } from "@radix-ui/themes";
import { Link, useRouterState } from "@tanstack/react-router";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { primaryNavigationItems } from "./navigation-items";

export function MobileNavigationDrawer() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const profileMedia = useProfileMedia();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const initial = user?.first_name?.[0]?.toUpperCase() ?? "A";
  const settingItems = settingsNavItems.filter((item) => !("adminOnly" in item) || isAdmin(user));

  const navigationLink = (item: { label: string; to: string; icon: typeof HamburgerMenuIcon }) => {
    const Icon = item.icon;
    const active = isPathActive(pathname, item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setOpen(false)}
        className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-violet-500/15 text-violet-600" : "hover:bg-foreground/5"}`}
      >
        <Icon width="20" height="20" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <IconButton size="3" variant="ghost" color="gray" className="lg:hidden!" aria-label="باز کردن منوی اصلی">
          <span className={`menu-toggle-icon ${open ? "is-open" : ""}`} aria-hidden="true"><span /><span /><span /></span>
        </IconButton>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal container={document.getElementById("app-theme-portal-root") ?? undefined}>
        <DialogPrimitive.Overlay className="mobile-drawer-overlay fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          className="mobile-drawer fixed inset-y-0 right-0 z-[81] flex h-dvh w-[min(88vw,23rem)] flex-col overflow-hidden border-l border-foreground/10 bg-background shadow-2xl focus:outline-none"
        >
          <Flex align="center" justify="between" gap="3" p="4" className="border-b border-foreground/10">
            <Flex align="center" gap="3" className="min-w-0">
              <Avatar src={profileMedia.src} fallback={initial} radius="full" />
              <Box className="min-w-0">
                <DialogPrimitive.Title asChild><Text as="div" weight="bold" className="truncate">{user ? `${user.first_name} ${user.last_name}` : "Tanzim"}</Text></DialogPrimitive.Title>
                <Text as="div" size="1" color="gray" className="truncate">{user ? `@${user.username}` : "مدیریت موجودی"}</Text>
              </Box>
            </Flex>
            <DialogPrimitive.Close asChild>
              <IconButton size="3" variant="soft" color="gray" aria-label="بستن منوی اصلی" className="drawer-close-button shrink-0"><span className="menu-toggle-icon is-open" aria-hidden="true"><span /><span /><span /></span></IconButton>
            </DialogPrimitive.Close>
          </Flex>

          <Box className="flex-1 overflow-y-auto overscroll-contain p-3">
            <Text as="div" size="1" color="gray" weight="bold" mb="2" className="px-2">منوی اصلی</Text>
            <Flex direction="column" gap="1">{primaryNavigationItems.map(navigationLink)}</Flex>
            <Separator size="4" my="4" />
            <Text as="div" size="1" color="gray" weight="bold" mb="2" className="px-2">تنظیمات</Text>
            <Flex direction="column" gap="1">{settingItems.map(navigationLink)}</Flex>
          </Box>
          <Box className="border-t border-foreground/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Text size="1" color="gray">منو با انتخاب هر بخش یا لمس بیرون بسته می‌شود.</Text>
          </Box>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
