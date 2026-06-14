import { TextArea } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";

type TextAreaProps = ComponentPropsWithoutRef<typeof TextArea>;

export function TextAreaInput({ ...props }: TextAreaProps) {
  return <TextArea {...props} />;
}
