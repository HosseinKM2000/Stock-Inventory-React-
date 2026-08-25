import { useState } from "react";
import { settingsNavItems } from "../data/settings-items";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DashboardIcon,
  ExitIcon,
} from "@radix-ui/react-icons";
import { useLogout } from "@/features/auth/mutations/use-register";
import { useAuth } from "@/shared/auth/use-auth";
import { isAdmin } from "@/shared/access/authorization";
import { isPathActive } from "@/shared/lib/navigation/is-path-active";
import { useProfileMedia } from "@/shared/profile-media/use-profile-media";
import { Avatar } from "@radix-ui/themes";

export function SettingNav() {
  const logout = useLogout();
  const { user } = useAuth();
  const profileMedia = useProfileMedia();
  const [collapsed, setCollapsed] = useState(false);
  const initial = user?.first_name?.[0]?.toUpperCase() ?? "A";

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside
      dir="rtl"
      className={`
        top-0
        sticky
        flex-1
        h-full
        flex-col
        border-l
        ease-in-out
        duration-300
        bg-background
        hidden lg:flex
        transition-all
        ${collapsed ? "w-20" : "w-72"}
      `}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-5">
        {!collapsed && (
          <div>
            <h1 className="font-bold text-lg text-indigo-600">Tanzim</h1>
          </div>
        )}
        <button
          className="
          h-8
          w-8
          flex
          rounded-md
          items-center
          justify-center
          hover:bg-foreground/10
          "
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      </div>

      {/* MENU */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center rounded-xl px-3 py-3 text-foreground transition-colors duration-200 hover:bg-indigo-300/10"
          >
            <DashboardIcon width={18} height={18} />
            {!collapsed && (
              <span className="mr-3 text-sm font-medium">داشبورد</span>
            )}
          </Link>

          <div className="my-2 border-t border-foreground/10" />

          {settingsNavItems.filter((item) => !("adminOnly" in item) || isAdmin(user)).map((item) => {
            const Icon = item.icon;
            const active = isPathActive(pathname, item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  flex
                  px-3
                  py-3
                  rounded-xl
                  items-center
                  duration-200
                  transition-colors
                  ${
                    active
                      ? "bg-indigo-700 text-white"
                      : "hover:bg-indigo-300/10 text-foreground"
                  }
                `}
              >
                <Icon width={18} height={18} />
                {!collapsed && (
                  <span className="mr-3 text-sm font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* FOOTER */}
      <div className="border-t p-3">
        <Link
          to="/setting/profile"
          className="mb-1 flex items-center rounded-xl px-3 py-3 transition-colors hover:bg-foreground/5"
        >
          <Avatar
            size="2"
            radius="full"
            fallback={initial}
            src={profileMedia.src}
            className="shrink-0"
          />
          {!collapsed && user && (
            <span className="mr-3 min-w-0 text-right">
              <span className="block truncate text-sm font-medium">
                {user.first_name} {user.last_name}
              </span>
              <span className="block truncate text-xs text-foreground/60">
                @{user.username}
              </span>
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={logout}
          className={`
            w-full
            flex
            px-3
            py-3
            rounded-xl
            items-center
            hover:bg-red-500
            cursor-pointer
          `}
        >
          <ExitIcon />
          {!collapsed && (
            <span className="mr-3 text-sm font-medium">
              {"خروج از حساب کاربری"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
