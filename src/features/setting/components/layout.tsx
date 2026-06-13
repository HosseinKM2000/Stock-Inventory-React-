import { Box } from "@radix-ui/themes";
import { SettingsMobileNav } from "./setting-mobile-nav";
import { SettingNav } from "./setting-nav";

export function SettingNavigation() {
  return (
    <Box>
      <SettingNav />
      <SettingsMobileNav />
    </Box>
  );
}
