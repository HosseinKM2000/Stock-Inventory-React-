import { useLayoutEffect, useRef, useState } from "react";

const KEYBOARD_THRESHOLD = 150;

export function useNavigationLayout() {
  const navigationRef = useRef<HTMLElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const root = document.documentElement;
    const updateNavigationHeight = () => {
      const height = Math.ceil(navigation.getBoundingClientRect().height);
      if (height > 0) root.style.setProperty("--app-bottom-navigation-measured-height", `${height}px`);
    };
    const updateKeyboardState = () => {
      const viewport = window.visualViewport;
      const occluded = viewport ? window.innerHeight - viewport.height - viewport.offsetTop : 0;
      const open = occluded > KEYBOARD_THRESHOLD;
      root.dataset.keyboardOpen = String(open);
      setKeyboardOpen(open);
    };

    const resizeObserver = new ResizeObserver(updateNavigationHeight);
    resizeObserver.observe(navigation);
    updateNavigationHeight();
    updateKeyboardState();
    window.addEventListener("resize", updateNavigationHeight);
    window.visualViewport?.addEventListener("resize", updateKeyboardState);
    window.visualViewport?.addEventListener("scroll", updateKeyboardState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateNavigationHeight);
      window.visualViewport?.removeEventListener("resize", updateKeyboardState);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardState);
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return { navigationRef, keyboardOpen };
}
