import Header from "@/features/app/layout/header";
import { SettingNavigation } from "@/features/setting/components/layout";
import { Box, Flex } from "@radix-ui/themes";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/shared/api/token-store";

export const Route = createFileRoute("/setting")({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
  },
  component: SettingLayout,
});

function SettingLayout() {
  return (
    <Flex
      direction="column"
      className="h-dvh overflow-hidden"
    >
      <Header />

      {/* Remaining viewport height */}
      <Flex className="flex-1 overflow-hidden">
        {/* Sidebar */}
        <Box
          className="
            hidden lg:flex
            w-72
            flex-col
            overflow-y-auto
            overflow-x-hidden
          "
        >
          <SettingNavigation />
        </Box>

        {/* Content */}
        <main
          className="
            flex-1
            overflow-y-auto
            p-4 md:p-10
          "
        >
          <Outlet />
        </main>
      </Flex>
    </Flex>
  );
}
