import { queryClient } from "@/shared/api/query-client";
import { Theme } from "@radix-ui/themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";

import "@/style/index.css";
import "@radix-ui/themes/styles.css";
import { AuthProvider } from "./shared/auth/auth-provider";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Theme appearance="dark" accentColor="violet">
          <Toaster
            richColors
            closeButton
            theme="system"
            expand={false}
            duration={4000}
            position="top-center"
            toastOptions={{
              className: "font-sans",
            }}
          />
          <RouterProvider router={router} />
        </Theme>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
