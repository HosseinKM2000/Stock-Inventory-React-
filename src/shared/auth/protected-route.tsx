import type { PropsWithChildren } from "react";
import { Navigate } from "@tanstack/react-router";

import { useAuth } from "./use-auth";

export function ProtectedRoute({
  children,
}: PropsWithChildren) {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  return children;
}