/* eslint-disable react-refresh/only-export-components */
import { keycloak } from "src/core/auth/keycloak";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!keycloak.authenticated) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Home Page</div>;
}
