import { Flex, Text } from "@radix-ui/themes";

import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { BackupShortcut } from "@/features/backup/components/backup-shortcut";
import ConnectionStatus from "./connection-status";

const Header = () => {
  return (
    <header
      dir="ltr"
      className="app-header grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-2 backdrop-blur-2xl sm:px-4"
    >
      <Flex align="center" justify="start" gap="2" className="app-header-left min-w-0">
        <BackupShortcut />
        <ConnectionStatus />
      </Flex>

      <Text size="3" weight="bold" className="app-header-title whitespace-nowrap text-center">
        Tanzim
      </Text>

      <Flex align="center" justify="end" gap={{ initial: "2", sm: "4" }} className="app-header-right min-w-0">
        <NotificationPanel />
      </Flex>
    </header>
  );
};

export default Header;
