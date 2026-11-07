import { pushJsonBatch } from "@/features/app/inventory/api/sync.api";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import { registerSyncHandler, type SyncHandlerResult } from "@/shared/lib/infrastructure/sync/sync-service";
import { assertSyncAccountCurrent, captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";
import { invoiceRepository } from "./invoice-repository";
import { INVOICE_ENTITY } from "./invoice-service";
import type { Invoice } from "./types";

function productStatus(product: Product, quantity: number) { return quantity <= 0 ? "out_of_stock" as const : product.low_stock_threshold > 0 && quantity <= product.low_stock_threshold ? "low_stock" as const : "in_stock" as const; }

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const account = captureSyncAccountContext();
  const response = await pushJsonBatch(items);
  assertSyncAccountCurrent(account);
  const output: SyncHandlerResult[] = [];
  for (const result of response.results) {
    const item = items.find((value) => value.operationId === result.operation_id);
    if (!item) continue;
    const local = await invoiceRepository.get(item.entityId);
    const record = result.record as { invoice?: Invoice; products?: Array<Partial<Product> & Pick<Product, "id" | "quantity">> } | null;
    if (result.status === "applied" && record?.invoice) {
      await invoiceRepository.save({ ...local, ...record.invoice, status: record.invoice.status === "cancelled" ? "cancelled" : "accepted" } as Invoice);
      for (const value of record.products ?? []) {
        const current = await inventoryRepository.get(value.id);
        if (current) await inventoryRepository.save({ ...current, ...value, status: productStatus(current, value.quantity) });
      }
    } else if (local) {
      const effects = item.action === "CREATE" ? local.lines.map((line) => ({ product_id: line.product_id, before: line.before_quantity, after: line.after_quantity })) : local.cancel_effects ?? [];
      for (const effect of effects) {
        const current = await inventoryRepository.get(effect.product_id);
        if (current?.quantity === effect.after) await inventoryRepository.save({ ...current, quantity: effect.before, status: productStatus(current, effect.before), updated_at: new Date().toISOString() });
      }
      await invoiceRepository.save(item.action === "CREATE"
        ? { ...local, status: result.status === "conflict" ? "conflict" : "rejected" }
        : { ...local, status: "accepted", cancel_operation_id: null, cancel_effects: undefined });
    }
    output.push({ itemId: item.id, status: result.status, error: result.error });
  }
  return output;
}

export function registerInvoiceSync() { registerSyncHandler(INVOICE_ENTITY, push); }
