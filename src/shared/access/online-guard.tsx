import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { Callout, Flex } from "@radix-ui/themes";
import type { PropsWithChildren } from "react";

export function OnlineGuard({ children }: PropsWithChildren) {
  const online = useOnline();
  if (!online) return (
    <Flex p="5"><Callout.Root color="amber" dir="rtl"><Callout.Text>این بخش به اتصال اینترنت نیاز دارد. پس از آنلاین شدن دوباره تلاش کنید.</Callout.Text></Callout.Root></Flex>
  );
  return children;
}
