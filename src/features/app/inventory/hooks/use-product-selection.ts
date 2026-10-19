import { useCallback, useEffect, useRef, useState } from "react";
import { accessState } from "@/shared/access/access-state";

export function useProductSelection(onAccountChange?: () => void) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const owner = useRef(accessState.user()?.id);
  const accountChangeHandler = useRef(onAccountChange);

  useEffect(() => {
    accountChangeHandler.current = onAccountChange;
  }, [onAccountChange]);

  useEffect(() => accessState.subscribe(() => {
    const nextOwner = accessState.user()?.id;
    if (owner.current !== nextOwner) {
      owner.current = nextOwner;
      setSelectedIds(new Set());
      accountChangeHandler.current?.();
    }
  }), []);

  const enter = useCallback((id: number) => setSelectedIds(new Set([id])), []);
  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const toggle = useCallback((id: number) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const retainAvailable = useCallback((available: ReadonlySet<number>) => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, []);
  const remove = useCallback((ids: Iterable<number>) => setSelectedIds((current) => {
    const next = new Set(current);
    for (const id of ids) next.delete(id);
    return next;
  }), []);

  return { selectedIds, selectionMode: selectedIds.size > 0, enter, toggle, clear, retainAvailable, remove };
}
