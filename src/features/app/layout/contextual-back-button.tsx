import { ArrowRightIcon } from "@radix-ui/react-icons";
import { IconButton } from "@radix-ui/themes";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { contextualBackFallback } from "@/shared/lib/navigation/contextual-back";

const CURRENT_PATH_KEY = "tanzim-navigation-current-path";

function readPreviousPath(pathname: string) {
  try {
    const current = sessionStorage.getItem(CURRENT_PATH_KEY);
    return current && current !== pathname ? current : null;
  } catch {
    return null;
  }
}

export function ContextualBackButton() {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previousPath = useRef(readPreviousPath(pathname));

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
    <IconButton
      type="button"
      size="2"
      color="gray"
      variant="ghost"
      className="page-guide-back"
      aria-label="بازگشت"
      onClick={goBack}
    >
      <ArrowRightIcon width="20" height="20" />
    </IconButton>
  );
}
