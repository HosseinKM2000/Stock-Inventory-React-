import { ArrowLeftIcon, BellIcon, HomeIcon } from "@radix-ui/react-icons";
import { Avatar, Box, Flex } from "@radix-ui/themes";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";

const Header = () => {
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const showHomeIcon = pathname.includes("setting");

  return (
    <header className="flex justify-between items-center px-5 py-3 border-b border-b-foreground/10">
      <Flex align={"center"} gapX={"5"}>
        <Avatar radius="full" fallback="A" />
        <Box className="relative">
          <BellIcon width={"25"} height={"25"} />
          <Box className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-0" />
        </Box>
        {showHomeIcon && (
          <Link to="/">
            <HomeIcon width={"25"} height={"25"} />
          </Link>
        )}
      </Flex>
      <Box onClick={() => router.history.back()}>
        <ArrowLeftIcon width={"25"} height={"25"} />
      </Box>
    </header>
  );
};

export default Header;
