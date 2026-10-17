import { Box, Flex, Text } from "@radix-ui/themes";
import { Link, useRouterState } from "@tanstack/react-router";
import { primaryNavigationItems } from "./navigation-items";
import { isPathActive } from "@/shared/lib/navigation/is-path-active";
import { useAuth } from "@/shared/auth/use-auth";
import { PersonIcon, PlusIcon } from "@radix-ui/react-icons";
import { accessState } from "@/shared/access/access-state";
import { isAdmin } from "@/shared/access/authorization";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import type { NavigationItem } from "./navigation-items";

type Props = {
  hidden?: boolean;
};

function NavigationLink({ item, active }: { item: NavigationItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      data-active={active}
      className="app-bottom-navigation-item relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-3 py-2 transition-all duration-200 ease-out active:scale-95 md:w-52 md:flex-none"
    >
      <Box className={`absolute -top-2 left-1/2 -translate-x-1/2 transition-all duration-300 ${active ? "opacity-100" : "opacity-0"}`}>
        <Box className="app-navigation-indicator h-[3px] w-12 rounded-full" />
      </Box>
      <Box className={`app-navigation-icon transition-all duration-200 ${active ? "scale-105" : ""}`}>
        <Icon width={20} height={20} />
      </Box>
      <Text size="1" className="app-bottom-navigation-label mt-1 whitespace-nowrap transition-all duration-200">
        {item.label}
      </Text>
    </Link>
  );
}

const NavMenu = ({ hidden = false }: Props) => {
  useEntitlementAccess();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { user } = useAuth();
  const items = primaryNavigationItems(user);
  const canAddProduct = accessState.canWrite() && (accessState.hasStorePermission?.("products.create") ?? true);
  const beforeAction = items.slice(0, 2);
  const afterAction = items.slice(2);
  return (
    <nav
      dir="rtl"
      className="
        app-bottom-navigation
        z-50
        fixed
        w-full
        bottom-0
        block!
        overflow-visible
      "
      data-hidden={hidden}
      aria-hidden={hidden}
      aria-label="ناوبری اصلی"
    >
      {isAdmin(user) && (
        <Link
          to="/management"
          aria-label="مدیریت"
          aria-current={isPathActive(pathname, "/management") ? "page" : undefined}
          data-active={isPathActive(pathname, "/management")}
          className="app-admin-shortcut"
        >
          <PersonIcon width="22" height="22" aria-hidden="true" />
        </Link>
      )}
      <Flex
        align="center"
        justify="center"
        className="
          app-bottom-navigation-surface
          relative

          border

          px-2
          py-2

          backdrop-blur-2xl
        "
      >
        {beforeAction.map((item) => (
          <NavigationLink key={item.to} item={item} active={isPathActive(pathname, item.to)} />
        ))}
        {canAddProduct && (
          <Link
            to="/inventory/add"
            className="app-bottom-navigation-add relative flex min-w-0 flex-1 items-center justify-center md:w-24 md:flex-none"
            aria-label="افزودن محصول"
          >
            <span className="app-bottom-navigation-add-button" aria-hidden="true">
              <PlusIcon width="32" height="32" />
            </span>
          </Link>
        )}
        {afterAction.map((item) => (
          <NavigationLink key={item.to} item={item} active={isPathActive(pathname, item.to)} />
        ))}
      </Flex>
    </nav>
  );
};

export default NavMenu;
