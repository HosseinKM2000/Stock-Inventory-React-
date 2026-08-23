import { useAuth } from "@/shared/auth/use-auth";
import { Callout } from "@radix-ui/themes";
import type { PropsWithChildren } from "react";
import { useEntitlement } from "./use-entitlement";
import { isAdmin } from "./authorization";

export function CapabilityGuard({ capability, admin = false, children }: PropsWithChildren<{ capability?: string; admin?: boolean }>) {
  const { user } = useAuth();
  const entitlement = useEntitlement();
  const administrator = isAdmin(user);
  const allowed = administrator || (
    !admin && (!capability || Boolean(entitlement?.capabilities[capability]))
  );
  if (!allowed) return <Callout.Root color="amber" dir="rtl"><Callout.Text>حساب شما مجوز دسترسی به این بخش را ندارد.</Callout.Text></Callout.Root>;
  return children;
}
