import { TextField } from "@radix-ui/themes";
import type { JSX } from "react/jsx-runtime";
import type { RefAttributes } from "react";

type Props = JSX.IntrinsicAttributes &
  TextField.RootProps &
  RefAttributes<HTMLInputElement>;

const FsInput = (props: Props) => {
  return <TextField.Root {...props}></TextField.Root>;
};

export default FsInput;
