import { Theme } from "@radix-ui/themes";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { getAppearance, type Appearance } from "./appearance";
import { DISPLAY_SIZE_EVENT, getDisplaySize, type DisplaySize } from "./display-size";

const toastIcons = {
  success: <CheckCircledIcon width="20" height="20" />,
  info: <InfoCircledIcon width="20" height="20" />,
  warning: <ExclamationTriangleIcon width="20" height="20" />,
  error: <CrossCircledIcon width="20" height="20" />,
  loading: <ReloadIcon width="20" height="20" />,
};

const toastClassNames = {
  toast: "app-toast",
  content: "app-toast-content",
  title: "app-toast-title",
  description: "app-toast-description",
  icon: "app-toast-icon",
  closeButton: "app-toast-close",
  actionButton: "app-toast-action",
  cancelButton: "app-toast-cancel",
};

export function AppTheme({ children }: PropsWithChildren) {
  const [appearance, update] = useState<Appearance>(getAppearance);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const [displaySize, updateDisplaySize] = useState<DisplaySize>(getDisplaySize);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => setSystemDark(media.matches);
    const onChange = (event: Event) => update((event as CustomEvent<Appearance>).detail);
    const onSizeChange = (event: Event) => updateDisplaySize((event as CustomEvent<DisplaySize>).detail);
    media.addEventListener("change", onMedia);
    window.addEventListener("appearance-change", onChange);
    window.addEventListener(DISPLAY_SIZE_EVENT, onSizeChange);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("appearance-change", onChange);
      window.removeEventListener(DISPLAY_SIZE_EVENT, onSizeChange);
    };
  }, []);

  const resolved = appearance === "system" ? (systemDark ? "dark" : "light") : appearance;

  useEffect(() => {
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.dataset.appearance = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolved === "dark" ? "#171326" : "#e6e0ef",
    );
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.displaySize = displaySize;
  }, [displaySize]);

  return (
    <Theme appearance={resolved} accentColor="violet" radius="small">
      <div id="app-theme-portal-root" dir="rtl">
        <Toaster
          className="app-toaster"
          richColors
          closeButton
          theme={resolved}
          dir="rtl"
          expand={false}
          duration={4500}
          position="top-center"
          gap={10}
          visibleToasts={4}
          offset={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}
          mobileOffset={{ top: "calc(.5rem + env(safe-area-inset-top, 0px))", left: ".5rem", right: ".5rem" }}
          icons={toastIcons}
          toastOptions={{ classNames: toastClassNames, closeButtonAriaLabel: "بستن اعلان" }}
          containerAriaLabel="اعلان‌های برنامه"
        />
        {children}
      </div>
    </Theme>
  );
}
