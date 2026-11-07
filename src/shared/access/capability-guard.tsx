import { useAuth } from "@/shared/auth/use-auth";
import { Callout } from "@radix-ui/themes";
import type { PropsWithChildren } from "react";
import { useEntitlementAccess } from "./use-entitlement";
import { isAdmin } from "./authorization";
import { accessState } from "./access-state";

export function CapabilityGuard({ capability, admin = false, children }: PropsWithChildren<{ capability?: string; admin?: boolean }>) {
  const { user } = useAuth();
  const entitlement = useEntitlementAccess();
  const administrator = isAdmin(user);
  const allowed = administrator || (
    !admin && (!capability || accessState.canUse(capability))
  );
  if (!allowed) return <Callout.Root color="amber" dir="rtl"><Callout.Text>{entitlement.requiresOnlineVerification ? "برای تأیید دسترسی اشتراک، به اینترنت متصل بمانید." : "حساب شما مجوز دسترسی به این بخش را ندارد."}</Callout.Text></Callout.Root>;
  return children;
}
