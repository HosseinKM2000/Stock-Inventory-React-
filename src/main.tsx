import React from "react";
import ReactDOM from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import { routeTree } from "./routeTree.gen";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "@radix-ui/themes/styles.css";
import "./index.css";
import { ToastProvider } from "@fs/organ";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </Theme>
  </React.StrictMode>,
);
