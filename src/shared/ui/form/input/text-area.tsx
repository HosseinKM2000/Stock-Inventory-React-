import { TextArea } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";

type TextInputProps = ComponentPropsWithoutRef<typeof TextArea>;

export function TextAreaInput({ ...props }: TextInputProps) {
  return <TextArea {...props} />;
}
