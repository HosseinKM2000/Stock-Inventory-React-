import { FaceIcon } from "@radix-ui/react-icons";
import { Box, Callout, Separator } from "@radix-ui/themes";
import FormatCads from "./file-format";
import DataScope from "./data-scope";

const ExportTools = () => {
  return (
    <Box mt={"6"}>
      <Callout.Root>
        <Callout.Icon>
          <FaceIcon />
        </Callout.Icon>
        <Callout.Text size={"2"} className="text-right">
          می توانید قبل از گرفتن لیست محصولات, نوع فایل خروجی و بازه محصولات
          مدنظر را انتخاب کنید.
        </Callout.Text>
      </Callout.Root>
      <Separator size={"4"} mt={"3"} />
      <FormatCads />
      <DataScope />
    </Box>
  );
};

export default ExportTools;
