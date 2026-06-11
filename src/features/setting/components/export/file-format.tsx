import { FileIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Box, Flex, RadioCards, Text } from "@radix-ui/themes";

const FormatCads = () => {
  return (
    <Box maxWidth="600px" mt={"5"}>
      <Text weight={"medium"}>نوع فایل</Text>
      <RadioCards.Root defaultValue="3" mt={"3"} columns={{ xs: "1", md: "3" }}>
        <RadioCards.Item value="1">
          <Flex align={"center"} direction="column" width="100%">
            <FileIcon width={"40"} height={"40"} />
            <Flex direction={"column"} align={"center"} mt={"3"}>
              <Text weight="bold" size={"4"}>
                Excel
              </Text>
              <Text>.xlsx</Text>
            </Flex>
          </Flex>
        </RadioCards.Item>
        <RadioCards.Item value="2">
          <Flex align={"center"} direction="column" width="100%">
            <FileTextIcon width={"40"} height={"40"} />
            <Flex direction={"column"} align={"center"} mt={"3"}>
              <Text weight="bold" size={"4"}>
                CSV
              </Text>
              <Text>.csv</Text>
            </Flex>
          </Flex>
        </RadioCards.Item>
        <RadioCards.Item value="3">
          <Flex align={"center"} direction="column" width="100%">
            <FileIcon width={"40"} height={"40"} />
            <Flex direction={"column"} align={"center"} mt={"3"}>
              <Text weight="bold" size={"4"}>
                PDF
              </Text>
              <Text>.pdf</Text>
            </Flex>
          </Flex>
        </RadioCards.Item>
      </RadioCards.Root>
    </Box>
  );
};

export default FormatCads;
