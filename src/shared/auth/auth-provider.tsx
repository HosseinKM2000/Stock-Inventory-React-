import { useCallback, useMemo } from "react";
import type { PropsWithChildren } from "react";

import { useMe, useLogout } from "@/features/auth/mutations/use-register";
import { getToken } from "@/shared/api/token-store";

import { AuthContext } from "./auth-context";

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const logout = useLogout();

  const hasToken = !!getToken();

  const {
    data: user,
    isLoading,
    isFetching,
    refetch,
  } = useMe(hasToken);

  const refetchUser = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({
      user: user ?? null,

      loading: hasToken && (isLoading || isFetching),

      isAuthenticated: !!user,

      logout,

      refetchUser,
    }),
    [
      user,
      hasToken,
      isLoading,
      isFetching,
      logout,
      refetchUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}