import { Box } from "@radix-ui/themes";
import type { ComponentType, ReactNode } from "react";

import { OnlineGuard } from "@/shared/access/online-guard";
import { PageGuide } from "./page-guide";

type Props = {
  title: string;
  description: string;
  icon: ComponentType<{ width?: number | string; height?: number | string }>;
  children: ReactNode;
};

export function ManagementPage({ title, description, icon, children }: Props) {
  return (
    <Box dir="rtl" className="w-full">
      <PageGuide
        section="مدیریت"
        sectionTo="/management"
        title={title}
        description={description}
        icon={icon}
      />
      <OnlineGuard>{children}</OnlineGuard>
    </Box>
  );
}
