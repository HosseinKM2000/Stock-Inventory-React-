import { useContext } from "react";
import { ToastContext } from "./toastProvider";

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within an ToastProvider");
  }
  return context;
};
