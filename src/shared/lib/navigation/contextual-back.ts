export type ContextualSection = "settings" | "tools";

export function contextualSection(pathname: string): ContextualSection | null {
  if (pathname === "/setting" || pathname.startsWith("/setting/")) return "settings";
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return "tools";
  return null;
}

export function contextualBackFallback(pathname: string) {
  const section = contextualSection(pathname);
  if (!section) return "/dashboard" as const;
  const root = section === "settings" ? "/setting" : "/tools";
  return pathname === root ? "/dashboard" as const : root;
}
