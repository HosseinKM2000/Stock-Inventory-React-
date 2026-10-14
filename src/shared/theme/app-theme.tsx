import { Theme } from "@radix-ui/themes";
import { useEffect, useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { getAppearance, type Appearance } from "./appearance";
import { DISPLAY_SIZE_EVENT, getDisplaySize, type DisplaySize } from "./display-size";

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
      resolved === "dark" ? "#171326" : "#ffffff",
    );
  }, [resolved]);

  useEffect(() => {
    document.documentElement.dataset.displaySize = displaySize;
  }, [displaySize]);

  return (
    <Theme appearance={resolved} accentColor="violet">
      <div id="app-theme-portal-root" dir="rtl">
        <Toaster richColors closeButton theme={resolved} dir="rtl" expand={false} duration={4000} position="top-center" />
        {children}
      </div>
    </Theme>
  );
}
