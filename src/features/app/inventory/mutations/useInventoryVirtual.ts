import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { DISPLAY_SIZE_EVENT } from "@/shared/theme/display-size";

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

  useEffect(() => {
    const measure = () => window.requestAnimationFrame(() => virtualizer.measure());
    window.addEventListener(DISPLAY_SIZE_EVENT, measure);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener(DISPLAY_SIZE_EVENT, measure);
      window.removeEventListener("resize", measure);
    };
  }, [virtualizer]);

  return {
    parentRef,
    virtualizer,
  };
}
