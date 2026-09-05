import { useCallback, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { useMe, useLogout } from "@/features/auth/mutations/use-register";
import { getToken } from "@/shared/api/token-store";

import { AuthContext } from "./auth-context";
import { accessState } from "@/shared/access/access-state";
import { useEffect } from "react";

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const logout = useLogout();
  const [, refreshAccountState] = useState(0);

  const hasToken = !!getToken();

  const {
    data: user,
    isLoading,
    isFetching,
    refetch,
  } = useMe(hasToken);

  const cachedUser = hasToken ? accessState.user() : null;
  const effectiveUser = user ?? cachedUser;

  useEffect(() => {
    if (user) accessState.saveUser(user);
  }, [user]);

  useEffect(() => {
    const refresh = () => refreshAccountState((value) => value + 1);
    return accessState.subscribe(refresh);
  }, []);

  const refetchUser = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({
      user: effectiveUser,

      loading: hasToken && (isLoading || isFetching),

      isAuthenticated: !!effectiveUser,

      logout,

      refetchUser,
    }),
    [
      effectiveUser,
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
