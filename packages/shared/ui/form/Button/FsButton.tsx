import type { RefAttributes } from "react";
import type { JSX } from "react/jsx-runtime";
import { Button, type ButtonProps } from "@radix-ui/themes";

type Props = JSX.IntrinsicAttributes &
  ButtonProps &
  RefAttributes<HTMLButtonElement> & { text?: string };

const FsButton = (props: Props) => {
  return <Button {...props}>{props.text ?? ""}</Button>;
};

export default FsButton;
