import { Switch } from "@radix-ui/themes";
import type { ComponentProps } from "react";

type SwitchInputProps = Omit<
  ComponentProps<typeof Switch>,
  "onCheckedChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;

  color?:
    | "gray"
    | "gold"
    | "bronze"
    | "brown"
    | "yellow"
    | "amber"
    | "orange"
    | "tomato"
    | "red"
    | "ruby"
    | "crimson"
    | "pink"
    | "plum"
    | "purple"
    | "violet"
    | "iris"
    | "indigo"
    | "blue"
    | "cyan"
    | "teal"
    | "jade"
    | "green"
    | "grass"
    | "lime"
    | "mint"
    | "sky";

  size?: "1" | "2" | "3";

  onCheckedChange?: (checked: boolean) => void;
};

export function SwitchInput({
  checked,
  disabled,
  size = "2",
  defaultChecked,
  color = "indigo",
  onCheckedChange,
  ...props
}: SwitchInputProps) {
  return (
    <Switch
      {...props}
      size={size}
      color={color}
      checked={checked}
      disabled={disabled}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
    />
  );
}
