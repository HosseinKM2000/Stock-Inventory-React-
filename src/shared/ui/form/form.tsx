import { Box } from "@radix-ui/themes";
import { useEffect, useId } from "react";
import type { ComponentPropsWithRef } from "react";
import { unsavedWork } from "@/features/app-update/services/unsaved-work";

type FormProps = ComponentPropsWithRef<"form"> & {
  isSubmitting?: boolean;
  isDirty?: boolean;
};

export function Form({ children, isSubmitting, isDirty = false, ...props }: FormProps) {
  const formId = useId();
  useEffect(() => {
    unsavedWork.set(formId, isDirty);
    return () => unsavedWork.set(formId, false);
  }, [formId, isDirty]);
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
