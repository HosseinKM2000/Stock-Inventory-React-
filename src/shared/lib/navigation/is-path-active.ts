/**
 * Matches a route itself or one of its nested children without matching
 * similarly prefixed siblings (for example, `/subscription` must not match
 * `/subscription-management`).
 */
export function isPathActive(pathname: string, route: string): boolean {
  const normalizedRoute = route.length > 1 ? route.replace(/\/+$/, "") : route;

  return (
    pathname === normalizedRoute ||
    pathname.startsWith(`${normalizedRoute}/`)
  );
}

export function isPrimaryNavigationActive(pathname: string, route: string): boolean {
  if (route === "/inventory/list") {
    return pathname === "/inventory" || pathname.startsWith("/inventory/");
  }
  return isPathActive(pathname, route);
}
