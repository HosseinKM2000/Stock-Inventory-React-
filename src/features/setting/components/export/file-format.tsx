import type { ExportFormat } from "@/features/setting/services/export.service";
import { FileIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Box, Flex, RadioCards, Text } from "@radix-ui/themes";

type FormatCadsProps = {
  value: ExportFormat;

  onChange(value: ExportFormat): void;
};

const FormatCads = ({ value, onChange }: FormatCadsProps) => {
  return (
    <Box maxWidth="600px" mt={"5"}>
      <Text weight={"medium"}>نوع فایل</Text>
      <RadioCards.Root
        value={value}
        onValueChange={(next) => onChange(next as ExportFormat)}
        mt={"3"}
        columns={{ xs: "1", md: "3" }}
      >
        <RadioCards.Item value="xlsx">
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
        <RadioCards.Item value="csv">
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
        <RadioCards.Item value="pdf">
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
