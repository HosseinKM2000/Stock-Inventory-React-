import { Box } from "@radix-ui/themes";
import { SettingsMobileNav } from "./SettingsMobileNav";
import { SettingNav } from "./SettingsNav";

export function SettingNavigation() {
  return (
    <Box>
      <SettingNav />
      <SettingsMobileNav />
    </Box>
  );
}
