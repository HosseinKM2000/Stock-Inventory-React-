import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export function useInventoryVirtual(count: number) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 250,
    overscan: 10,
  });

  return {
    parentRef,
    virtualizer,
  };
}