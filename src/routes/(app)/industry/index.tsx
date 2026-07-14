import IndustryForm from "@/features/setting/components/industry/industry-form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/industry/")({
  component: IndustryForm,
});
