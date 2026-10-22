import { useLayoutEffect, useRef, useState } from "react";

const KEYBOARD_THRESHOLD = 150;

function isEditableElement(element: Element | null): boolean {
  return element instanceof HTMLElement && element.matches(
    "input:not([readonly]), textarea:not([readonly]), select, [contenteditable='true']",
  );
}

export function useNavigationLayout() {
  const navigationRef = useRef<HTMLElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const root = document.documentElement;
    const initialViewport = window.visualViewport;
    let viewportBaseline = initialViewport?.height ?? window.innerHeight;
    const updateNavigationHeight = () => {
      const height = Math.ceil(navigation.getBoundingClientRect().height);
      if (height > 0) root.style.setProperty("--app-bottom-navigation-measured-height", `${height}px`);
    };
    const updateKeyboardState = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const editing = isEditableElement(document.activeElement);
      if (!editing) viewportBaseline = viewportHeight;
      const occluded = viewport ? window.innerHeight - viewport.height - viewport.offsetTop : 0;
      const heightLoss = viewportBaseline - viewportHeight;
      const open = editing && Math.max(occluded, heightLoss) > KEYBOARD_THRESHOLD;
      root.dataset.keyboardOpen = String(open);
      setKeyboardOpen(open);
    };

    const resizeObserver = new ResizeObserver(updateNavigationHeight);
    resizeObserver.observe(navigation);
    updateNavigationHeight();
    updateKeyboardState();
    window.addEventListener("resize", updateNavigationHeight);
    window.addEventListener("resize", updateKeyboardState);
    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", updateKeyboardState);
    window.visualViewport?.addEventListener("resize", updateKeyboardState);
    window.visualViewport?.addEventListener("scroll", updateKeyboardState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateNavigationHeight);
      window.removeEventListener("resize", updateKeyboardState);
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", updateKeyboardState);
      window.visualViewport?.removeEventListener("resize", updateKeyboardState);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardState);
      delete root.dataset.keyboardOpen;
    };
  }, []);

  return { navigationRef, keyboardOpen };
}
