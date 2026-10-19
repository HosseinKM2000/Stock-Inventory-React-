import Industries from "@/features/setting/components/industry";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/industries")({
  component: () => <OnlineGuard><Industries /></OnlineGuard>,
});
