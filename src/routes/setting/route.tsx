import Header from "@/features/app/layout/header";
import { SettingNavigation } from "@/features/setting/components/layout";
import { Box, Flex } from "@radix-ui/themes";
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/shared/api/token-store";
import NavMenu from "@/features/app/layout/nav-menu";
import { useState } from "react";

export const Route = createFileRoute("/setting")({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
  },
  component: SettingLayout,
});

function SettingLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Flex
      direction="column"
      className="h-dvh overflow-hidden"
    >
      <Header onMenuOpenChange={setDrawerOpen} />

      {/* Remaining viewport height */}
      <Flex className="flex-1 overflow-hidden">
        {/* Sidebar */}
        <Box
          className="
            hidden! lg:flex!
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
            app-responsive-page app-shell-content flex-1
            min-w-0
            overflow-y-auto
            overflow-x-hidden
            p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-10
          "
        >
          <Outlet />
        </main>
      </Flex>
      <NavMenu hidden={drawerOpen} />
    </Flex>
  );
}
