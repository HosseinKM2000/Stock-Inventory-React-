import { useLogout, useMe } from "@/features/auth/mutations/use-register";
import {
  ArrowLeftIcon,
  BellIcon,
  ExitIcon,
  HomeIcon,
} from "@radix-ui/react-icons";
import { Avatar, Box, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import ConnectionStatus from "./connection-status";

const Header = () => {
  const router = useRouter();
  const logout = useLogout();
  const { data: me } = useMe();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const showHomeIcon = pathname.includes("setting");
  const initial = me?.first_name?.[0]?.toUpperCase() ?? "A";

  return (
    <header className="flex justify-between items-center px-5 py-3 border-b border-b-foreground/10">
      <Flex align={"center"} gapX={"5"}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Avatar
              radius="full"
              fallback={initial}
              className="cursor-pointer"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {me && (
              <DropdownMenu.Label>
                {me.first_name} {me.last_name}
              </DropdownMenu.Label>
            )}
            <DropdownMenu.Item color="red" onClick={logout}>
              <ExitIcon />
              خروج
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <Box className="relative">
          <BellIcon width={"25"} height={"25"} />
          <Box className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-0" />
        </Box>
        {showHomeIcon && (
          <Link to="/dashboard">
            <HomeIcon width={"25"} height={"25"} />
          </Link>
        )}

        <ConnectionStatus />
      </Flex>
      <IconButton
        variant="ghost"
        color="gray"
        onClick={() => router.history.back()}
      >
        <ArrowLeftIcon width={"25"} height={"25"} />
      </IconButton>
    </header>
  );
};

export default Header;
