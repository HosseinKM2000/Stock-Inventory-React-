import {
  Crosshair1Icon,
  ExclamationTriangleIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Box, CheckboxCards, Flex, Select, Text } from "@radix-ui/themes";

const DataScope = () => {
  return (
    <Box mt={"5"}>
      <CheckboxCards.Root
        defaultValue={["1"]}
        columns={{ initial: "1", sm: "1" }}
      >
        <CheckboxCards.Item value="1">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <MixIcon />
            <Text weight="bold">همه محصولات</Text>
          </Flex>
        </CheckboxCards.Item>
        <CheckboxCards.Item value="2">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <Crosshair1Icon />
            <Text weight="bold">دسته بندی خاص</Text>
          </Flex>
        </CheckboxCards.Item>
        <CheckboxCards.Item value="3">
          <Flex width="100%" align={"center"} gapX={"3"}>
            <ExclamationTriangleIcon />
            <Text weight="bold">فقط محصولات محدود</Text>
          </Flex>
        </CheckboxCards.Item>
      </CheckboxCards.Root>
      <Flex mt={"5"} direction={"column"} gapY={"3"}>
        <Text>دسته بندی</Text>
        <Select.Root size="3" defaultValue="apple">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="orange">Orange</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>
    </Box>
  );
};

export default DataScope;
