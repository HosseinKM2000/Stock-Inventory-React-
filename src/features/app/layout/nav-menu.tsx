import { Box, Flex, Text } from "@radix-ui/themes";
import { Link, useRouterState } from "@tanstack/react-router";
import { primaryNavigationItems } from "./navigation-items";
import { isPathActive } from "@/shared/lib/navigation/is-path-active";

const NavMenu = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return (
    <Box
      dir="rtl"
      className="
        app-bottom-navigation
        z-50
        fixed
        w-full
        bottom-0
        block!
        overflow-hidden
      "
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
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
        {primaryNavigationItems.map((item) => {
          const Icon = item.icon;

          const active = isPathActive(pathname, item.to);
              
          return (
            <Link
              key={item.to}
              to={item.to}
              data-active={active}
              className="
                app-bottom-navigation-item
                flex
                px-3
                py-2
                w-[25%]
                md:w-70
                relative
                flex-col
                ease-out
                rounded-2xl
                items-center
                duration-200
                justify-center
                transition-all
                active:scale-95
              "
            >
              {/* Lamp Indicator */}

              <Box
                className={`
                  absolute
                  -top-2
                  left-1/2
                  -translate-x-1/2

                  transition-all
                  duration-300

                  ${active ? "opacity-100" : "opacity-0"}
                `}
              >
                {/* Main Line */}

                <Box
                  className="app-navigation-indicator h-[3px] w-15 rounded-full"
                />

                {/* Glow */}

                <Box
                  className="
                    app-navigation-glow
                    absolute
                    left-1/2
                    top-0

                    h-5
                    w-16

                    -translate-x-1/2
                    -translate-y-1/2

                    rounded-full

                    blur-xl
                  "
                />
              </Box>

              {/* Icon */}

              <Box
                className={`
                  transition-all
                  duration-200

                  ${active ? "scale-105" : ""}
                `}
              >
                <Icon width={20} height={20} />
              </Box>

              {/* Label */}

              <Text
                size="1"
                className="
                  mt-1

                  transition-all
                  duration-200
                "
              >
                {item.label}
              </Text>
            </Link>
          );
        })}
      </Flex>
    </Box>
  );
};

export default NavMenu;
