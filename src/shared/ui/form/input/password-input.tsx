"use client";

import { IconButton, TextField } from "@radix-ui/themes";
import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

type PasswordInputProps = ComponentPropsWithoutRef<typeof TextField.Root> & {
  leftSlot?: ReactNode;
};

export function PasswordInput({ leftSlot, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField.Root {...props} type={visible ? "text" : "password"}>
      {leftSlot && <TextField.Slot side="left">{leftSlot}</TextField.Slot>}

      <TextField.Slot side="right">
        <IconButton
          size="1"
          color="gray"
          type="button"
          variant="ghost"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
        </IconButton>
      </TextField.Slot>
    </TextField.Root>
  );
}
