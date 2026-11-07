import { describe, expect, it } from "vitest";
import { calculateInvoiceDashboardReport } from "@/features/app/dashboard/services/invoice-dashboard-report";
import type { Invoice } from "@/features/invoices/types";

function invoice(id: number, patch: Partial<Invoice> = {}): Invoice {
  return {
    id, local_user_id: 1, local_store_id: 2, invoice_type: "sale", title: `فاکتور ${id}`, counterparty: null,
    status: "accepted", total_amount: 100, actor_user_id: 1, actor_membership_id: 3,
    post_operation_id: `operation-${id}`, posted_at: "2026-11-04T20:31:00.000Z", lines: [], ...patch,
  };
}

describe("invoice dashboard report", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");

  it("uses Tehran day boundaries and immutable invoice totals", () => {
    const report = calculateInvoiceDashboardReport([
      invoice(1, { invoice_type: "purchase", total_amount: 0, posted_at: "2026-11-04T20:31:00.000Z" }),
      invoice(2, { total_amount: 500, posted_at: "2026-11-04T20:29:59.000Z" }),
      invoice(3, { total_amount: 900, posted_at: "2026-10-05T20:30:00.000Z" }),
    ], { now, completeHistory: true, canViewPurchase: true, canViewSale: true, solo: true });
    expect(report.windows.today.purchase).toMatchObject({ kind: "value", count: 1, total: 0 });
    expect(report.windows.today.sale).toMatchObject({ kind: "value", count: 0, total: 0 });
    expect(report.windows.sevenDays.sale).toMatchObject({ kind: "value", count: 1, total: 500 });
    expect(report.windows.thirtyDays.sale).toMatchObject({ kind: "value", count: 1, total: 500 });
  });

  it("excludes nonconfirmed states, keeps cancel-pending in the confirmed baseline, and separates Solo pending", () => {
    const report = calculateInvoiceDashboardReport([
      invoice(1),
      invoice(1, { status: "accepted" }),
      invoice(2, { status: "cancelled" }),
      invoice(3, { status: "cancel_pending", total_amount: 300 }),
      invoice(4, { status: "conflict", total_amount: 400 }),
      invoice(5, { status: "rejected", total_amount: 500 }),
      invoice(6, { status: "pending", total_amount: 600 }),
    ], { now, completeHistory: false, canViewPurchase: true, canViewSale: true, solo: true });
    expect(report.windows.today.sale).toMatchObject({ kind: "value", count: 2, total: 400, pendingCancellationCount: 1 });
    expect(report.unconfirmedSolo.today.sale).toMatchObject({ count: 1, total: 600 });
    expect(report.completeHistory).toBe(false);
  });

  it("redacts purchase aggregates including counts and does not expose Team pending work", () => {
    const report = calculateInvoiceDashboardReport([
      invoice(1, { invoice_type: "purchase", total_amount: 700 }),
      invoice(2, { status: "pending", total_amount: 800 }),
    ], { now, completeHistory: true, canViewPurchase: false, canViewSale: true, solo: false });
    expect(report.windows.today.purchase).toEqual({ kind: "restricted" });
    expect(report.unconfirmedSolo.today.purchase).toEqual({ kind: "restricted" });
    expect(report.unconfirmedSolo.today.sale).toMatchObject({ kind: "value", count: 0, total: 0 });
  });
});
