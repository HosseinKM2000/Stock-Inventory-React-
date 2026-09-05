import { Select } from "@radix-ui/themes";
import type { ComponentProps } from "react";

type Option = {
  label: string;
  value: string;
};

type SelectInputProps = Omit<ComponentProps<typeof Select.Root>, "children"> & {
  options: Option[];
  placeholder?: string;
};

export function SelectInput({
  options,
  placeholder = "Select...",
  ...props
}: SelectInputProps) {
  return (
    <Select.Root {...props}>
      <Select.Trigger dir="rtl" className="w-full!" placeholder={placeholder} />

      <Select.Content>
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
