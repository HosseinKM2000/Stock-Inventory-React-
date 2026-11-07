export type InvoiceStatus = "pending" | "accepted" | "conflict" | "rejected" | "cancel_pending" | "cancelled";

export type InvoiceLine = {
  id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit: "عدد" | "بسته";
  pack_size: number | null;
  base_quantity: number;
  unit_price: number | null;
  line_total: number | null;
  before_quantity: number;
  after_quantity: number;
};

export type Invoice = {
  local_key?: string;
  local_user_id?: number;
  local_store_id?: number;
  id: number;
  invoice_type: "purchase" | "sale";
  title: string;
  counterparty: string | null;
  status: InvoiceStatus;
  total_amount: number | null;
  actor_user_id: number;
  actor_membership_id: number | null;
  post_operation_id: string;
  cancel_operation_id?: string | null;
  posted_at: string;
  cancelled_at?: string | null;
  lines: InvoiceLine[];
  cancel_effects?: Array<{ product_id: number; before: number; after: number }>;
};

export type InvoiceCommandLine = {
  product_id: number;
  quantity: number;
  unit: "unit" | "pack";
  pack_size: number | null;
  unit_price: number;
};
