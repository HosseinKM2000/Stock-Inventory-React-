import IndustryForm from "@/features/setting/components/industry/industry-form";
import { OnlineGuard } from "@/shared/access/online-guard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/industry/")({
  component: IndustrySelectionPage,
});

function IndustrySelectionPage() {
  return (
    <OnlineGuard>
      <IndustryForm />
    </OnlineGuard>
  );
}
