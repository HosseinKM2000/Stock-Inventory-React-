import { AlertDialog, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button/button";

type ConfirmVariant = "danger" | "warning" | "success";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
};

const colors = {
  danger: "red",
  warning: "amber",
  success: "green",
} as const;

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  variant = "warning",
  loading = false,
  disabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
    >
      <AlertDialog.Content
        dir="rtl"
        maxWidth="460px"
        className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <AlertDialog.Title color={colors[variant]}>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">
          <Text as="span" color="gray">{description}</Text>
        </AlertDialog.Description>
        <Flex gap="3" mt="5" justify="end" wrap="wrap-reverse">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" disabled={loading}>
              {cancelLabel}
            </Button>
          </AlertDialog.Cancel>
          <Button
            color={colors[variant]}
            loading={loading}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
