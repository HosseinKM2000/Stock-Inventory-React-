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
    let frame: number | null = null;
    let measuredWidth = parentRef.current?.clientWidth ?? window.innerWidth;
    const scheduleMeasure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        virtualizer.measure();
        parentRef.current
          ?.querySelectorAll<HTMLElement>("[data-index]")
          .forEach((element) => virtualizer.measureElement(element));
      });
    };
    const handleResize = () => {
      const nextWidth = parentRef.current?.clientWidth ?? window.innerWidth;
      if (Math.abs(nextWidth - measuredWidth) < 1) return;
      measuredWidth = nextWidth;
      scheduleMeasure();
    };

    window.addEventListener(DISPLAY_SIZE_EVENT, scheduleMeasure);
    window.addEventListener("resize", handleResize);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener(DISPLAY_SIZE_EVENT, scheduleMeasure);
      window.removeEventListener("resize", handleResize);
    };
  }, [virtualizer]);

  return {
    parentRef,
    virtualizer,
  };
}
