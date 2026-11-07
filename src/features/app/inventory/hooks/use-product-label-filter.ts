import { useCallback, useEffect, useRef, useState } from "react";
import { accessState } from "@/shared/access/access-state";

export function useProductLabelFilter() {
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const owner = useRef(accessState.user()?.id);

  useEffect(() => accessState.subscribe(() => {
    const nextOwner = accessState.user()?.id;
    if (owner.current !== nextOwner) {
      owner.current = nextOwner;
      setSelectedLabelIds([]);
    }
  }), []);

  const toggle = useCallback((id: number) => setSelectedLabelIds((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ), []);
  const remove = useCallback((id: number) => setSelectedLabelIds((current) =>
    current.filter((item) => item !== id)
  ), []);
  const clear = useCallback(() => setSelectedLabelIds([]), []);
  const retainAvailable = useCallback((available: ReadonlySet<number>) => {
    setSelectedLabelIds((current) => {
      const next = current.filter((id) => available.has(id));
      return next.length === current.length ? current : next;
    });
  }, []);

  return { selectedLabelIds, toggle, remove, clear, retainAvailable };
}
