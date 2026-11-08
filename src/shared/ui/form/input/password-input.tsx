"use client";

import { IconButton, TextField } from "@radix-ui/themes";
import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

type PasswordInputProps = ComponentPropsWithoutRef<typeof TextField.Root> & {
  leftSlot?: ReactNode;
  eyeSide?: "left" | "right";
};

export function PasswordInput({ leftSlot, eyeSide = "right", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField.Root {...props} type={visible ? "text" : "password"}>
      {leftSlot && <TextField.Slot side="left">{leftSlot}</TextField.Slot>}

      <TextField.Slot side={eyeSide}>
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
