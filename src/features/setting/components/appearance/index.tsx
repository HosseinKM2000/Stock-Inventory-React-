import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Box, Flex, Switch } from "@radix-ui/themes";

const AppearanceOptions = () => {
  return (
    <Box mt={"6"}>
      <Flex align={"center"} gapX={"3"}>
        <MoonIcon />
        <Switch color="violet" size={"3"} defaultChecked highContrast />
        <SunIcon />
      </Flex>
    </Box>
  );
};

export default AppearanceOptions;
