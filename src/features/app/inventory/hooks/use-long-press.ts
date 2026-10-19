import { useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

const DEFAULT_DELAY = 850;
const MOVE_TOLERANCE = 12;

export function useLongPress(onLongPress: () => void, delay = DEFAULT_DELAY) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    fired.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
      navigator.vibrate?.(20);
      cancel();
    }, delay);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const start = origin.current;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE
    ) {
      cancel();
    }
  };

  const suppressClickAfterLongPress = (event: ReactMouseEvent<HTMLElement>) => {
    if (!fired.current) return;
    event.preventDefault();
    event.stopPropagation();
    fired.current = false;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: suppressClickAfterLongPress,
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      if (origin.current || fired.current) event.preventDefault();
    },
  };
}
