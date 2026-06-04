import { useState } from "react";
import { sidebarItems } from "../data/settingItems";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, ExitIcon } from "@radix-ui/react-icons";

export function SettingNav() {
  const [collapsed, setCollapsed] = useState(false);

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside
      dir="rtl"
      className={`
        top-0
        sticky
        flex-col
        border-l
        h-screen
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
            <h1 className="font-bold text-lg text-indigo-600">StockFlow</h1>

            <p className="text-xs text-foreground">Retail Business Pro</p>
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
          hover:bg-gray-100
          "
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      </div>

      {/* MENU */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.to);

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
                      ? "bg-indigo-700 text-foreground"
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
          to={"/"}
          className={`
            flex
            px-3
            py-3
            rounded-xl
            items-center
            hover:bg-red-500
          `}
        >
          <ExitIcon />
          {!collapsed && <span className="mr-3 text-sm font-medium">{"خروج از حساب کاربری"}</span>}
        </Link>
      </div>
    </aside>
  );
}
