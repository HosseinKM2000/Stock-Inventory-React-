import IndustryForm from "@/features/app/industry/components/industry-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/industry/")({
  component: IndustryForm,
});
