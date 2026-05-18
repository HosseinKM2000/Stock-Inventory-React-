import * as Toast from "@radix-ui/react-toast";
import type { ComponentPropsWithoutRef } from "react";
import { createContext, useCallback, useState } from "react";

type ToastRootProps = ComponentPropsWithoutRef<typeof Toast.Root>;

import "./styles.css";

type DelayTime = 2000 | 3000 | 4000 | 5000 | 10000;

type ToastState = {
  id: string;
  label: string;
  delay: DelayTime;
  open: boolean;
  toastProps?: ToastRootProps;
};

type TriggerToastArgs = {
  label: string;
  delay?: DelayTime;
  toastProps?: ToastRootProps;
};

type ToastContextProps = {
  toasts: ToastState[];
  triggerToast: (args: TriggerToastArgs) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextProps | undefined>(
  undefined,
);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const triggerToast = useCallback(
    ({ label, delay = 3000, toastProps }: TriggerToastArgs) => {
      const id = `toast-${toastIdCounter++}`;
      const newToast: ToastState = {
        id,
        label,
        delay,
        open: true,
        toastProps,
      };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => closeToast(id), delay);
    },
    [closeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, triggerToast }}>
      {children}
      <Toast.Provider swipeDirection="down">
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            open={t.open}
            className="ToastRoot"
            onOpenChange={(v) => (v ? null : closeToast(t.id))}
            duration={t.delay}
            {...t.toastProps}
          >
            <Toast.Action
              className="ToastAction"
              asChild
              altText="Goto schedule to undo"
            >
              <button className="Button small green">بستن</button>
            </Toast.Action>
            <Toast.Title className="ToastTitle">{t.label}</Toast.Title>
          </Toast.Root>
        ))}

        <Toast.Viewport className="ToastViewport" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
