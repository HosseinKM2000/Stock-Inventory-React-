import type { ParsedLocation } from "@tanstack/router-core";

const DASHBOARD_RETURN_ANCHOR_PREFIX = "tanzim-dashboard-return-anchor:";

function dashboardReturnAnchorKey(userId: number | undefined) {
  return `${DASHBOARD_RETURN_ANCHOR_PREFIX}${userId ?? "anonymous"}`;
}

export function rememberDashboardReturnAnchor(userId: number | undefined, anchorId: string) {
  try {
    sessionStorage.setItem(dashboardReturnAnchorKey(userId), anchorId);
  } catch {
    // The router remains usable when session storage is unavailable.
  }
}

export function consumeDashboardReturnAnchor(userId: number | undefined) {
  try {
    const key = dashboardReturnAnchorKey(userId);
    const anchorId = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return anchorId;
  } catch {
    return null;
  }
}

export function accountScrollRestorationKey(
  location: ParsedLocation,
  userId: number | undefined,
) {
  const routeKey = location.pathname === "/dashboard" || location.pathname === "/dashboard/"
    ? "dashboard"
    : location.state.__TSR_key ?? location.href;
  return `${userId ?? "anonymous"}:${routeKey}`;
}
