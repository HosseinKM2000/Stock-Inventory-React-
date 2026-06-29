import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,

        retry(failureCount, error: any) {
          if (error?.status === 401) {
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
