import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(public)/setting/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div>
      <h1>Profile Settings</h1>
    </div>
  );
}