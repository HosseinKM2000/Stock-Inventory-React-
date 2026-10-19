import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

export function useInventoryVirtual(count: number, estimateSize = 250) {
  const parentRef = useRef<HTMLDivElement>(null);

  // TanStack Virtual intentionally returns imperative functions. React
  // Compiler must leave this hook unmemoized to avoid stale measurements.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  return {
    parentRef,
    virtualizer,
  };
}
