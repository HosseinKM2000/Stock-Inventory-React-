import { isAuthenticated } from "@/shared/api/token-store";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: isAuthenticated() ? "/dashboard" : "/auth/login",
    });
  },
});
