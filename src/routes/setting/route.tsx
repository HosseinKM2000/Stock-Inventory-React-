import Header from "@/features/app/layout/header";
import { SettingNavigation } from "@/features/setting/components/layout";
import { Box, Flex } from "@radix-ui/themes";
import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting")({
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
            p-10
          "
        >
          <Outlet />
        </main>
      </Flex>
    </Flex>
  );
}