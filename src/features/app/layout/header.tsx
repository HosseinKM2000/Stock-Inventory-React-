import { useLogout, useMe } from "@/features/auth/mutations/use-register";
import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { useProfileMedia } from "@/shared/profile-media/use-profile-media";
import { ArrowLeftIcon, ExitIcon, HomeIcon } from "@radix-ui/react-icons";
import { Avatar, Box, DropdownMenu, Flex, IconButton, Text } from "@radix-ui/themes";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import ConnectionStatus from "./connection-status";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";

const Header = () => {
  const router = useRouter();
  const logout = useLogout();
  const { data: me } = useMe();
  const profileMedia = useProfileMedia();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showHomeIcon = pathname.startsWith("/setting");
  const initial = me?.first_name?.[0]?.toUpperCase() ?? "A";

  return (
    <header className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-b-foreground/10 px-2 sm:px-5">
      <Flex align="center" gap="1" className="min-w-0">
        <MobileNavigationDrawer />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Avatar radius="full" fallback={initial} src={profileMedia.src} className="cursor-pointer" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content style={{ direction: "rtl" }}>
            {me && <DropdownMenu.Label>{me.first_name} {me.last_name}</DropdownMenu.Label>}
            <DropdownMenu.Item color="red" onClick={logout}><ExitIcon />خروج</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <NotificationPanel />
        <Box className="hidden md:block"><ConnectionStatus /></Box>
      </Flex>

      <Text size="3" weight="bold" className="max-w-24 truncate text-center sm:max-w-none">Tanzim</Text>

      <Flex align="center" justify="end" gap="1">
        {showHomeIcon && <Link to="/dashboard" className="hidden lg:inline-flex"><IconButton variant="ghost" color="gray" aria-label="خانه"><HomeIcon width="22" height="22" /></IconButton></Link>}
        <IconButton variant="ghost" color="gray" size="3" aria-label="بازگشت" onClick={() => router.history.back()}>
          <ArrowLeftIcon width="22" height="22" />
        </IconButton>
      </Flex>
    </header>
  );
};

export default Header;
