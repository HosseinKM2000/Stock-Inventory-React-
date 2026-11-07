import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent, RefObject } from "react";
import { storage } from "@/shared/lib/infrastructure/storage/local-storage";

const STORAGE_KEY = "tanzim-admin-shortcut-position-v1";
const SHORTCUT_SIZE = 48;
const EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;

type Position = { x: number; y: number };
type SavedPosition = { xRatio: number; yRatio: number };
type DragState = {
  pointerId: number;
  startPointer: Position;
  startPosition: Position;
  currentPosition: Position;
  moved: boolean;
};

function movementBounds(navigation: HTMLElement | null) {
  const navigationTop = navigation?.getBoundingClientRect().top ?? window.innerHeight;
  return {
    minX: EDGE_GAP,
    maxX: Math.max(EDGE_GAP, window.innerWidth - SHORTCUT_SIZE - EDGE_GAP),
    minY: EDGE_GAP,
    maxY: Math.max(EDGE_GAP, navigationTop - SHORTCUT_SIZE - EDGE_GAP),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampPosition(position: Position, navigation: HTMLElement | null): Position {
  const bounds = movementBounds(navigation);
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

function positionFromSaved(saved: SavedPosition, navigation: HTMLElement | null): Position {
  const bounds = movementBounds(navigation);
  return {
    x: bounds.minX + clamp(saved.xRatio, 0, 1) * (bounds.maxX - bounds.minX),
    y: bounds.minY + clamp(saved.yRatio, 0, 1) * (bounds.maxY - bounds.minY),
  };
}

function savedFromPosition(position: Position, navigation: HTMLElement | null): SavedPosition {
  const bounds = movementBounds(navigation);
  return {
    xRatio: bounds.maxX === bounds.minX ? 0 : (position.x - bounds.minX) / (bounds.maxX - bounds.minX),
    yRatio: bounds.maxY === bounds.minY ? 0 : (position.y - bounds.minY) / (bounds.maxY - bounds.minY),
  };
}

function validSavedPosition(value: SavedPosition | null): value is SavedPosition {
  return Boolean(value && Number.isFinite(value.xRatio) && Number.isFinite(value.yRatio));
}

export function useDraggableAdminShortcut(navigationRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const dragStateRef = useRef<DragState | null>(null);
  const savedPositionRef = useRef<SavedPosition | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const restoreSavedPosition = useCallback(() => {
    if (!enabled || !savedPositionRef.current) return;
    setPosition(positionFromSaved(savedPositionRef.current, navigationRef.current));
  }, [enabled, navigationRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const saved = storage.get<SavedPosition>(STORAGE_KEY);
    if (validSavedPosition(saved)) {
      savedPositionRef.current = saved;
      restoreSavedPosition();
    }

    const navigation = navigationRef.current;
    const resizeObserver = navigation ? new ResizeObserver(restoreSavedPosition) : null;
    if (navigation) resizeObserver?.observe(navigation);
    window.addEventListener("resize", restoreSavedPosition);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", restoreSavedPosition);
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
    };
  }, [enabled, navigationRef, restoreSavedPosition]);

  const onPointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const startPosition = { x: rect.left, y: rect.top };
    dragStateRef.current = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition,
      currentPosition: startPosition,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startPointer.x;
    const deltaY = event.clientY - dragState.startPointer.y;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    event.preventDefault();
    dragState.moved = true;
    dragState.currentPosition = clampPosition({
      x: dragState.startPosition.x + deltaX,
      y: dragState.startPosition.y + deltaY,
    }, navigationRef.current);
    event.currentTarget.dataset.dragging = "true";
    event.currentTarget.style.left = `${dragState.currentPosition.x}px`;
    event.currentTarget.style.top = `${dragState.currentPosition.y}px`;
    event.currentTarget.style.right = "auto";
    event.currentTarget.style.bottom = "auto";
  };

  const finishDrag = (event: PointerEvent<HTMLAnchorElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.dragging;
    dragStateRef.current = null;

    if (!dragState.moved) return;
    suppressClickRef.current = true;
    setPosition(dragState.currentPosition);
    const saved = savedFromPosition(dragState.currentPosition, navigationRef.current);
    savedPositionRef.current = saved;
    storage.set(STORAGE_KEY, saved);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 100);
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;

  return {
    style,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
  };
}
