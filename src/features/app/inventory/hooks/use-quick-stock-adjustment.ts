import { useCallback, useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

const HOLD_DELAY_MS = 350;
const REPEAT_INTERVAL_MS = 110;
const MOVEMENT_THRESHOLD_PX = 12;

type Point = { x: number; y: number; pointerId: number };
type Options = { onRepeat: () => void; onFinish: () => void };

export function useQuickStockAdjustment({ onRepeat, onFinish }: Options) {
  const [pressing, setPressing] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const origin = useRef<Point | null>(null);
  const pressed = useRef(false);
  const changed = useRef(false);
  const repeatRef = useRef(onRepeat);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    repeatRef.current = onRepeat;
    finishRef.current = onFinish;
  }, [onFinish, onRepeat]);

  const clearTimers = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (repeatTimer.current !== null) window.clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    pressed.current = false;
    changed.current = false;
    origin.current = null;
    setPressing(false);
    setRepeating(false);
  }, [clearTimers]);

  const complete = useCallback((applySingleClick: boolean) => {
    if (!pressed.current) return;
    if (!changed.current && applySingleClick) {
      changed.current = true;
      repeatRef.current();
    }
    const shouldConfirm = changed.current;
    cancel();
    if (shouldConfirm) finishRef.current();
  }, [cancel]);

  const release = useCallback(() => complete(true), [complete]);
  const abort = useCallback(() => complete(false), [complete]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const begin = useCallback(() => {
    if (pressed.current) return;
    clearTimers();
    pressed.current = true;
    changed.current = false;
    setPressing(true);
    holdTimer.current = window.setTimeout(() => {
      changed.current = true;
      setRepeating(true);
      repeatRef.current();
      if ("vibrate" in navigator) navigator.vibrate?.(18);
      repeatTimer.current = window.setInterval(() => repeatRef.current(), REPEAT_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }, [clearTimers]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    origin.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    begin();
  }, [begin]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = origin.current;
    if (!start || start.pointerId !== event.pointerId || changed.current) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVEMENT_THRESHOLD_PX) cancel();
  }, [cancel]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    begin();
  }, [begin]);

  const onKeyUp = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    release();
  }, [release]);

  return {
    pressing,
    repeating,
    holdProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: abort,
      onPointerLeave: abort,
      onKeyDown,
      onKeyUp,
      onBlur: abort,
      onClick: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
    },
  };
}
