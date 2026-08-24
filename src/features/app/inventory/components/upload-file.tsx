import { Cross2Icon, ImageIcon, Pencil1Icon } from "@radix-ui/react-icons";

import { Box, Button, Card, Flex, IconButton, Text } from "@radix-ui/themes";

import { useRef } from "react";

type ProductImageUploadProps = {
  value?: string;
  disabled?: boolean;
  onChange?: (file: File | null) => void;
};

export function ProductImageUpload({
  value,
  disabled = false,
  onChange,
}: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled) return;

    inputRef.current?.click();
  };

  const handleFile = (file: File | null) => {
    if (!file) return;

    onChange?.(file);
  };

  const handleRemove = () => {
    if (disabled) return;

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
        accept="image/jpeg,image/png,image/webp,image/avif"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {!value ? (
        <Card
          className={`
              rounded-3xl
              border-2
              border-dashed
              border-foreground/15
              ${!disabled && "cursor-pointer hover:bg-foreground/5"}
            `}
          onClick={openPicker}
        >
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            py="8"
          >
            <ImageIcon width={40} height={40} />

            <Text>تصویر محصول</Text>

            {!disabled && (
              <Button type="button" variant="soft">
                انتخاب تصویر
              </Button>
            )}
          </Flex>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl">
          <Box className="relative">
            <img
              src={value}
              alt="product"
              className="
                  h-64
                  w-full
                  object-cover
                "
            />

            {!disabled && (
              <Flex
                gap="2"
                className="
                      absolute
                      left-3
                      top-3
                    "
              >
                <IconButton type="button" onClick={openPicker}>
                  <Pencil1Icon />
                </IconButton>

                <IconButton type="button" color="red" onClick={handleRemove}>
                  <Cross2Icon />
                </IconButton>
              </Flex>
            )}
          </Box>
        </Card>
      )}
    </Box>
  );
}
