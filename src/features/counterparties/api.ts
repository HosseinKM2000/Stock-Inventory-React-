import { apiFetch } from "@/shared/api/client";

export type Counterparty = {
  id: number;
  kind: "person" | "organization";
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartyInput = Pick<Counterparty, "kind" | "name" | "phone" | "address">;

export const counterpartyKeys = { all: ["counterparties"] as const };

export const counterpartiesApi = {
  list: () => apiFetch<Counterparty[]>("/counterparties"),
  create: (input: CounterpartyInput) => apiFetch<Counterparty>("/counterparties", { method: "POST", json: input }),
  update: (id: number, input: Partial<CounterpartyInput>) => apiFetch<Counterparty>(`/counterparties/${id}`, { method: "PATCH", json: input }),
  remove: (id: number) => apiFetch<void>(`/counterparties/${id}`, { method: "DELETE" }),
};
