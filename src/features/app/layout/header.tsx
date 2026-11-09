import { Flex, Text } from "@radix-ui/themes";
import { useRouterState } from "@tanstack/react-router";

import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { BackupShortcut } from "@/features/backup/components/backup-shortcut";
import ConnectionStatus from "./connection-status";
import { getHeaderSectionTitle } from "./header-section-title";

const Header = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sectionTitle = getHeaderSectionTitle(pathname);

  return (
    <header
      dir="ltr"
      className="app-header grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-2 backdrop-blur-2xl sm:px-4"
    >
      <Flex align="center" justify="start" gap="2" className="app-header-left min-w-0">
        <BackupShortcut />
        <ConnectionStatus />
      </Flex>

      <Text as="div" dir="rtl" size="3" weight="bold" aria-live="polite" className="app-header-title whitespace-nowrap text-center">
        {sectionTitle}
      </Text>

      <Flex align="center" justify="end" gap={{ initial: "2", sm: "4" }} className="app-header-right min-w-0">
        <NotificationPanel />
      </Flex>
    </header>
  );
};

export default Header;
