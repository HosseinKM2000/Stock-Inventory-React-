import { createFileRoute } from "@tanstack/react-router";
import RegisterComponent from "@/features/auth/components/Register";

export const Route = createFileRoute("/auth/register")({
  component: RegisterComponent,
});
