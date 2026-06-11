import { Box, Separator, Text } from "@radix-ui/themes";
import FormatCads from "./file-format";

const ExportTools = () => {
  return (
    <Box mt={"6"}>
      <Text size={"2"}>
        می توانید قبل از گرفتن لیست محصولات, نوع فایل خروجی و بازه محصولات مدنظر
        را انتخاب کنید.
      </Text>
      <Separator size={"4"} mt={"3"}/>
      <FormatCads />
    </Box>
  );
};

export default ExportTools;
