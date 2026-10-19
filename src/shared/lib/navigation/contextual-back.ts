export type ContextualSection = "settings" | "tools" | "management";

export function contextualSection(pathname: string): ContextualSection | null {
  if (pathname === "/setting" || pathname.startsWith("/setting/")) return "settings";
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return "tools";
  if (pathname === "/management" || pathname.startsWith("/management/")) return "management";
  return null;
}

export function contextualBackFallback(pathname: string) {
  const section = contextualSection(pathname);
  if (!section) return "/dashboard" as const;
  const root = section === "settings" ? "/setting" : section === "tools" ? "/tools" : "/management";
  return pathname === root ? "/dashboard" as const : root;
}
