import { createFileRoute } from "@tanstack/react-router";
import SignupComponent from "src/features/auth/components/Signup";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupComponent,
});
