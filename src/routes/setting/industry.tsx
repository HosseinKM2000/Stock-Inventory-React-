import IndustryForm from "@/features/setting/components/industry/industry-form";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/setting/industry")({ component: IndustryPage });

function IndustryPage() {
  return <OnlineGuard><IndustryForm embedded /></OnlineGuard>;
}
