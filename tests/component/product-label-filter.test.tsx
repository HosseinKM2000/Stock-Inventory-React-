import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProductLabelFilter } from "@/features/app/inventory/hooks/use-product-label-filter";
import { accessState } from "@/shared/access/access-state";
import type { User } from "@/features/auth/types";

const user = (id: number): User => ({
  id, first_name: "Test", last_name: String(id), username: `user-${id}`,
  email: null, phone: null, industry_id: null, plan: "free", is_active: true,
  is_admin: false, role: "USER", is_system_admin: false,
  subscription_started_at: null, subscription_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
});

describe("product label filter state", () => {
  beforeEach(() => { accessState.clear(); accessState.saveUser(user(1)); });

  it("supports multiple labels and removes deleted labels safely", () => {
    const { result } = renderHook(() => useProductLabelFilter());
    act(() => { result.current.toggle(7); result.current.toggle(8); });
    expect(result.current.selectedLabelIds).toEqual([7, 8]);
    act(() => result.current.retainAvailable(new Set([8, 9])));
    expect(result.current.selectedLabelIds).toEqual([8]);
  });

  it("clears user-owned label filters when the account changes", () => {
    const { result } = renderHook(() => useProductLabelFilter());
    act(() => result.current.toggle(7));
    act(() => accessState.saveUser(user(2)));
    expect(result.current.selectedLabelIds).toEqual([]);
  });
});
