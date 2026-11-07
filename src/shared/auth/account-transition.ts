import type { QueryClient } from "@tanstack/react-query";

import type { User } from "@/features/auth/types";
import { accessState } from "@/shared/access/access-state";

/** Prevents in-memory query results from crossing an authenticated account boundary. */
export function transitionToAccount(queryClient: QueryClient, user: User) {
  if (accessState.user()?.id !== user.id) {
    queryClient.removeQueries();
  }
  accessState.saveUser(user);
}
