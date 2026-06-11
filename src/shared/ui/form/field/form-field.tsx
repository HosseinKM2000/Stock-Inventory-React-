import { Box, Text } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";

type LabelProps = {
  size?: ComponentPropsWithoutRef<typeof Text>["size"];
  weight?: ComponentPropsWithoutRef<typeof Text>["weight"];
  color?: ComponentPropsWithoutRef<typeof Text>["color"];
  align?: ComponentPropsWithoutRef<typeof Text>["align"];
};

type FormFieldProps = {
  id: string;
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
  labelProps?: LabelProps;
  children: React.ReactNode;
};

export function FormField({
  id,
  label,
  error,
  required,
  children,
  description,
  labelProps,
}: FormFieldProps) {
  return (
    <Box>
      {label && (
        <Text
          as="label"
          htmlFor={id}
          color={labelProps?.color}
          align={labelProps?.align}
          size={labelProps?.size ?? "2"}
          className="w-full inline-block"
          weight={labelProps?.weight ?? "medium"}
        >
          {label}

          {required && (
            <Text as="span" color="red">
              *
            </Text>
          )}
        </Text>
      )}

      <Box mt="2">{children}</Box>

      {description && !error && (
        <Text as="p" size="1" color="gray" mt="1">
          {description}
        </Text>
      )}

      {error && (
        <Text as="p" size="1" dir="rtl" color="red" mt="1">
          {error}
        </Text>
      )}
    </Box>
  );
}
