import { TextField } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";

type TextInputProps =
  ComponentPropsWithoutRef<
    typeof TextField.Root
  > & {
    leftSlot?: React.ReactNode;
    rightSlot?: React.ReactNode;
  };

export function TextInput({
  leftSlot,
  rightSlot,
  ...props
}: TextInputProps) {
  return (
    <TextField.Root {...props}>
        {rightSlot && (
          <TextField.Slot
            side="right"
          >
            {rightSlot}
          </TextField.Slot>
        )}

      {leftSlot && (
        <TextField.Slot
          side="left"
        >
          {leftSlot}
        </TextField.Slot>
      )}

    </TextField.Root>
  );
}