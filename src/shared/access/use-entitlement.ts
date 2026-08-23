import { apiFetch } from "@/shared/api/client";
import { isAuthenticated } from "@/shared/api/token-store";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { accessState, type Entitlement } from "./access-state";

export function useEntitlement() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ["auth", "entitlement"],
    queryFn: async () => {
      const value = await apiFetch<Entitlement>("/plans/current");
      accessState.saveEntitlement(value);
      return value;
    },
    enabled: isAuthenticated(),
    initialData: accessState.entitlement() ?? undefined,
    retry: false,
  });
  const value = query.data ?? null;
  if (
    value && value.plan !== "free" && value.expires_at &&
    new Date(value.expires_at).getTime() <= now
  ) {
    return {
      ...value,
      status: "expired" as const,
      capabilities: Object.fromEntries(
        Object.keys(value.capabilities).map((key) => [key, key === "inventory.read"]),
      ),
    };
  }
  return value;
}
