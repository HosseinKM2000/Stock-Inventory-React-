import { ArrowRightIcon } from "@radix-ui/react-icons";
import { Flex, IconButton, Text } from "@radix-ui/themes";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { NotificationPanel } from "@/features/notifications/components/notification-panel";
import { BackupShortcut } from "@/features/backup/components/backup-shortcut";
import { contextualBackFallback, contextualSection } from "@/shared/lib/navigation/contextual-back";
import ConnectionStatus from "./connection-status";

const CURRENT_PATH_KEY = "tanzim-navigation-current-path";

function readPreviousPath(pathname: string) {
  try {
    const current = sessionStorage.getItem(CURRENT_PATH_KEY);
    return current && current !== pathname ? current : null;
  } catch {
    return null;
  }
}

const Header = () => {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previousPath = useRef(readPreviousPath(pathname));
  const section = contextualSection(pathname);

  useEffect(() => {
    try {
      const current = sessionStorage.getItem(CURRENT_PATH_KEY);
      if (current && current !== pathname) previousPath.current = current;
      sessionStorage.setItem(CURRENT_PATH_KEY, pathname);
    } catch {
      previousPath.current = null;
    }
  }, [pathname]);

  const goBack = () => {
    const hasSafeInAppHistory =
      router.history.canGoBack() &&
      previousPath.current?.startsWith("/") &&
      !previousPath.current.startsWith("/auth");

    if (hasSafeInAppHistory) {
      router.history.back();
      return;
    }
    void navigate({ to: contextualBackFallback(pathname) });
  };

  return (
    <header
      dir="ltr"
      className="app-header grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-2 backdrop-blur-2xl sm:px-5"
    >
      <Flex align="center" justify="start" gap="2" className="app-header-left min-w-0">
        <BackupShortcut />
        <NotificationPanel />
        {section && (
          <IconButton size="3" color="gray" variant="ghost" aria-label="بازگشت" onClick={goBack}>
            <ArrowRightIcon width="22" height="22" />
          </IconButton>
        )}
      </Flex>

      <Text size="3" weight="bold" className="app-header-title whitespace-nowrap text-center">
        Tanzim
      </Text>

      <Flex align="center" justify="end" gap={{ initial: "2", sm: "4" }} className="app-header-right min-w-0">
        <div className="app-header-sync-status min-w-0">
          <ConnectionStatus />
        </div>
      </Flex>
    </header>
  );
};

export default Header;
