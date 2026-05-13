import React from "react";
import ReactDOM from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import { routeTree } from "../routeTree.gen";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import "@radix-ui/themes/styles.css";
import { initAuth } from "src/core/auth/auth";
import "../index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export async function bootstrap() {
  const isAuthenticated = await initAuth();
  
  console.log("authenticated:", isAuthenticated);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Theme appearance="dark">
        <RouterProvider router={router} />
      </Theme>
    </React.StrictMode>,
  );
}
