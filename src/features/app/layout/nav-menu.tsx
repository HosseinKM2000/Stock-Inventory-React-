import {
  DotsHorizontalIcon,
  GearIcon,
  HomeIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Box, Flex, Text } from "@radix-ui/themes";
import { Link, useRouterState } from "@tanstack/react-router";

export const settingsNavItems = [
  {
    label: "بیشتر",
    to: "/more",
    icon: DotsHorizontalIcon,
  },
  {
    label: "تنظیمات",
    to: "/setting/profile",
    icon: GearIcon,
  },
  {
    label: "محصولات",
    to: "/products",
    icon: MixIcon,
  },
  {
    label: "خانه",
    to: "/",
    icon: HomeIcon,
  },
] as const;

const NavMenu = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return (
    <Box
      dir="rtl"
      className="
        z-50
        fixed
        w-full
        bottom-0
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
          relative

          border
          border-white/10

          bg-[rgba(15,15,24,0.92)]

          px-2
          py-2

          shadow-[0_20px_50px_rgba(0,0,0,.35)]

          backdrop-blur-2xl
        "
      >
        {settingsNavItems.map((item) => {
          const Icon = item.icon;

          const active = pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className="
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
                  className="
                    h-[3px]
                    w-15
                    rounded-full
                  bg-indigo-600
                  "
                />

                {/* Glow */}

                <Box
                  className="
                    absolute
                    left-1/2
                    top-0

                    h-5
                    w-16

                    -translate-x-1/2
                    -translate-y-1/2

                    rounded-full

               bg-indigo-600
                    blur-xl
                  "
                />
              </Box>

              {/* Icon */}

              <Box
                className={`
                  transition-all
                  duration-200

                  ${active ? "scale-105 text-primary" : "text-white/60"}
                `}
              >
                <Icon width={20} height={20} />
              </Box>

              {/* Label */}

              <Text
                size="1"
                className={`
                  mt-1

                  transition-all
                  duration-200

                  ${active ? "text-primary" : "text-white/60"}
                `}
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
