import { apiFetch } from "@/shared/api/client";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { assertSyncAccountCurrent, captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";
import { invoiceRepository } from "./invoice-repository";
import type { Invoice } from "./types";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { accessState } from "@/shared/access/access-state";

export const INVOICE_HISTORY_COMPLETE_AT = "invoice-history-complete-at";

type ServerInvoice = Omit<Invoice, "status"> & { status: "posted" | "cancelled" };

export async function refreshInvoiceHistory() {
  if (networkService.isOffline() || !accessState.canUse("sync")) return false;
  const account = captureSyncAccountContext();
  const records = await apiFetch<ServerInvoice[]>("/invoices");
  assertSyncAccountCurrent(account);
  await invoiceRepository.saveManyForScope(records.map((invoice) => ({
    ...invoice,
    status: invoice.status === "posted" ? "accepted" : "cancelled",
  })), account.actorUserId, account.storeId);
  assertSyncAccountCurrent(account);
  await syncMetadataStorage.set(INVOICE_HISTORY_COMPLETE_AT, Date.now());
  assertSyncAccountCurrent(account);
  return true;
}
