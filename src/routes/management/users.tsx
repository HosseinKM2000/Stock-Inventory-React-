import UsersSettings from "@/features/setting/components/users";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/management/users")({
  component: () => <OnlineGuard><UsersSettings /></OnlineGuard>,
});
