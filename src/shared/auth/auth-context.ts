import { createContext } from "react";
import type { User } from "@/features/auth/types";

export type AuthContextValue = {
  user: User | null;

  loading: boolean;

  isAuthenticated: boolean;

  logout: () => void;

  refetchUser: () => Promise<void>;
};

export const AuthContext =
  createContext<AuthContextValue | null>(null);