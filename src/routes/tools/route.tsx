import { SectionLayout } from "@/features/app/layout/section-layout";
import { isAuthenticated } from "@/shared/api/token-store";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tools")({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: "/auth/login" });
  },
  component: SectionLayout,
});
