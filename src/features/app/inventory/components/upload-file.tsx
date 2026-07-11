import { Cross2Icon, ImageIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { Box, Button, Card, Flex, IconButton, Text } from "@radix-ui/themes";
import { useRef } from "react";

type ProductsImageUploadProps = {
  value?: string;
  onChange?: (file: File | null) => void;
};

export function ProductImageUpload({
  value,
  onChange,
}: ProductsImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;

    onChange?.(file);
  };

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleRemove = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    onChange?.(null);
  };

  return (
    <Box dir="rtl">
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {!value ? (
        <Card
          className="
            cursor-pointer
            rounded-3xl
            border-2
            border-dashed
            border-foreground/15
            transition-all
            hover:border-accent-8
            hover:bg-foreground/5
          "
          onClick={openPicker}
        >
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            py="8"
          >
            <Box className="text-accent-9">
              <ImageIcon width={40} height={40} />
            </Box>

            <Text weight="medium">تصویر محصول را انتخاب کنید</Text>

            <Text size="2" color="gray" align="center">
              کلیک کنید یا تصویر را بکشید و رها کنید
            </Text>

            <Button variant="soft">انتخاب تصویر</Button>
          </Flex>
        </Card>
      ) : (
        <Card className="rounded-3xl overflow-hidden">
          <Box className="relative">
            <img
              src={value}
              alt="Product Preview"
              className="
                h-64
                w-full
                object-cover
              "
            />

            <Flex
              gap="2"
              className="
                absolute
                top-3
                left-3
              "
            >
              <IconButton radius="full" variant="solid" onClick={openPicker}>
                <Pencil1Icon />
              </IconButton>

              <IconButton
                radius="full"
                color="red"
                variant="solid"
                onClick={handleRemove}
              >
                <Cross2Icon />
              </IconButton>
            </Flex>
          </Box>
        </Card>
      )}
    </Box>
  );
}
