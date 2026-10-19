import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProductSelection } from "@/features/app/inventory/hooks/use-product-selection";
import { accessState } from "@/shared/access/access-state";
import type { User } from "@/features/auth/types";

const user = (id: number): User => ({
  id, first_name: "Test", last_name: String(id), username: `user-${id}`,
  email: null, phone: null, industry_id: null, plan: "free", is_active: true,
  is_admin: false, role: "USER", is_system_admin: false,
  subscription_started_at: null, subscription_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
});

describe("product selection state", () => {
  beforeEach(() => { accessState.clear(); accessState.saveUser(user(1)); });

  it("uses stable ids across rerenders and keeps filtered-out selections", () => {
    const { result, rerender } = renderHook(() => useProductSelection());
    act(() => { result.current.enter(11); result.current.toggle(22); });
    rerender();
    expect([...result.current.selectedIds]).toEqual([11, 22]);
    act(() => result.current.retainAvailable(new Set([11, 22, 33])));
    expect([...result.current.selectedIds]).toEqual([11, 22]);
    act(() => result.current.retainAvailable(new Set([22])));
    expect([...result.current.selectedIds]).toEqual([22]);
  });

  it("clears selection and closes processing UI when the account changes", () => {
    const onAccountChange = vi.fn();
    const { result } = renderHook(() => useProductSelection(onAccountChange));
    act(() => result.current.enter(11));
    act(() => accessState.saveUser(user(2)));
    expect(result.current.selectedIds.size).toBe(0);
    expect(onAccountChange).toHaveBeenCalledOnce();
  });

  it("clears completed ids from selection without affecting unresolved ids", () => {
    const { result } = renderHook(() => useProductSelection());
    act(() => { result.current.enter(11); result.current.toggle(22); });
    act(() => result.current.remove([11]));
    expect([...result.current.selectedIds]).toEqual([22]);
  });
});
