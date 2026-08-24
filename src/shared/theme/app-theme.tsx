import { Theme } from "@radix-ui/themes";
import { useEffect, useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { getAppearance, type Appearance } from "./appearance";

export function AppTheme({ children }: PropsWithChildren) {
  const [appearance, update] = useState<Appearance>(getAppearance);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => setSystemDark(media.matches);
    const onChange = (event: Event) => update((event as CustomEvent<Appearance>).detail);
    media.addEventListener("change", onMedia);
    window.addEventListener("appearance-change", onChange);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("appearance-change", onChange);
    };
  }, []);

  const resolved = appearance === "system" ? (systemDark ? "dark" : "light") : appearance;

  useEffect(() => {
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      resolved === "dark" ? "#111113" : "#ffffff",
    );
  }, [resolved]);

  return (
    <Theme appearance={resolved} accentColor="violet">
      <div dir="rtl">
        <Toaster richColors closeButton theme={resolved} dir="rtl" expand={false} duration={4000} position="top-center" />
        {children}
      </div>
    </Theme>
  );
}
