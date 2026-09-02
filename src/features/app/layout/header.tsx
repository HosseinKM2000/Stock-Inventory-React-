import { useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Flex, IconButton, Text } from "@radix-ui/themes";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { NotificationPanel } from "@/features/notifications/components/notification-panel";

const Header = () => {
  const router = useRouter();

  return (
    <header
      dir="ltr"
      className="app-header grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-b-foreground/10 px-2 sm:px-5"
    >
      <Flex align="center" justify="start" gap="3" className="app-header-left min-w-0">
        <IconButton
          size="3"
          color="gray"
          variant="ghost"
          aria-label="بازگشت"
          onClick={() => router.history.back()}
        >
          <ArrowLeftIcon width="22" height="22" />
        </IconButton>
      </Flex>

      <Text
        size="3"
        weight="bold"
        className="app-header-title whitespace-nowrap text-center"
      >
        Tanzim
      </Text>

      <Flex align="center" justify="end" gap="5" className="app-header-right min-w-0">
        <NotificationPanel />
        <MobileNavigationDrawer />
      </Flex>
    </header>
  );
};

export default Header;
