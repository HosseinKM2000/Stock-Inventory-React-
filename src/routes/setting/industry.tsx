import Industries from "@/features/setting/components/industry";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/industry")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Industries />;
}
