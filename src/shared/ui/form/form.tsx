import { Box } from "@radix-ui/themes";
import type { ComponentPropsWithoutRef } from "react";

type FormProps = ComponentPropsWithoutRef<"form"> & {
  isSubmitting?: boolean;
};

export function Form({ children, isSubmitting, ...props }: FormProps) {
  return (
    <Box
      asChild
      style={{
        pointerEvents: isSubmitting ? "none" : undefined,
      }}
    >
      <form {...props}>{children}</form>
    </Box>
  );
}
