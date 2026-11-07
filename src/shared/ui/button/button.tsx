"use client";

import { Button as RadixButton } from "@radix-ui/themes";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

type ButtonProps = ComponentPropsWithoutRef<typeof RadixButton> & {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  intent?: "positive";
};

export function Button({
  children,
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  intent,
  ...props
}: ButtonProps) {
  return (
    <RadixButton
      size="3"
      loading={loading}
      disabled={disabled || loading}
      data-intent={intent}
      {...props}
    >
      {!loading && leftIcon}

      {children}

      {!loading && rightIcon}
    </RadixButton>
  );
}
