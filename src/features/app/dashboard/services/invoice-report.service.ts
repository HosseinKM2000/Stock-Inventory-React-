import { invoiceRepository } from "@/features/invoices/invoice-repository";
import { INVOICE_HISTORY_COMPLETE_AT, refreshInvoiceHistory } from "@/features/invoices/invoice-history";
import { accessState } from "@/shared/access/access-state";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { assertSyncAccountCurrent, captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";
import { calculateInvoiceDashboardReport } from "./invoice-dashboard-report";

export const invoiceReportService = {
  async get() {
    accessState.requireStorePermission("invoices.view");
    if (!accessState.canUse("invoices.purchase") && !accessState.canUse("invoices.sale")) {
      accessState.requireCapability("invoices.sale");
    }
    const account = captureSyncAccountContext();
    try { await refreshInvoiceHistory(); } catch { /* Durable scoped history remains readable after a transient failure. */ }
    assertSyncAccountCurrent(account);
    const [invoices, completeAt] = await Promise.all([
      invoiceRepository.getAll(),
      syncMetadataStorage.getNumber(INVOICE_HISTORY_COMPLETE_AT),
    ]);
    assertSyncAccountCurrent(account);
    const user = accessState.user();
    return {
      ...calculateInvoiceDashboardReport(invoices, {
        now: new Date(), completeHistory: completeAt > 0,
        canViewPurchase: accessState.canUse("invoices.purchase") && accessState.hasStorePermission("products.purchase_price.view"),
        canViewSale: accessState.canUse("invoices.sale") && accessState.hasStorePermission("products.sale_price.view"),
        solo: user?.store_operating_mode === "solo",
      }),
      completeAt: completeAt || null,
    };
  },
};
