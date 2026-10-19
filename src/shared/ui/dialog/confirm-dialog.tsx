import {
  CheckIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { AlertDialog, Box, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

import { Button } from "@/shared/ui/button/button";

type ConfirmVariant = "danger" | "warning" | "success";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  icon?: ReactNode;
  details?: ReactNode;
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

const defaultIcons = {
  danger: <TrashIcon width="22" height="22" />,
  warning: <ExclamationTriangleIcon width="22" height="22" />,
  success: <CheckIcon width="22" height="22" />,
} as const;

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  details,
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
        className="action-confirm-dialog"
        data-variant={variant}
      >
        <Box className="action-confirm-icon" aria-hidden="true">
          {icon ?? defaultIcons[variant]}
        </Box>
        <AlertDialog.Title className="action-confirm-title" color={colors[variant]}>
          {title}
        </AlertDialog.Title>
        <AlertDialog.Description className="action-confirm-description" size="2">
          <Text as="span" color="gray">{description}</Text>
        </AlertDialog.Description>
        {details ? <Box className="action-confirm-details">{details}</Box> : null}
        <Box className="action-confirm-actions">
          <Button
            color={colors[variant]}
            intent={variant === "danger" ? undefined : "positive"}
            loading={loading}
            disabled={disabled}
            onClick={onConfirm}
          >
            <CheckIcon aria-hidden="true" />
            {confirmLabel}
          </Button>
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" disabled={loading}>
              {cancelLabel}
            </Button>
          </AlertDialog.Cancel>
        </Box>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
