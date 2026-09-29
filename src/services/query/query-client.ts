import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/api-error";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,

        retry(failureCount, error) {
          if (error instanceof ApiError && error.status === 401) {
            return false;
          }

          return failureCount < 2;
        },

        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },

      mutations: {
        retry: false,
      },
    },
  });
}
