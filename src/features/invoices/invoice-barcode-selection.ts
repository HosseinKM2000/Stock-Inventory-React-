import type { Product } from "@/features/app/inventory/types";
import { barcodeRepository } from "@/features/barcode/services/barcode-repository";
import type { ProductBarcode } from "@/features/barcode/types";
import { accessState } from "@/shared/access/access-state";
import { assertSyncAccountCurrent, captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";

export type InvoiceBarcodeResult =
  | { kind: "unique"; product: Product; barcode: ProductBarcode }
  | { kind: "unknown" }
  | { kind: "ambiguous" };

export async function lookupInvoiceBarcode(value: string, products: Product[], invoiceType: "purchase" | "sale"): Promise<InvoiceBarcodeResult> {
  accessState.requireCapability(invoiceType === "purchase" ? "invoices.purchase" : "invoices.sale");
  accessState.requireCapability("barcode.lookup");
  accessState.requireStorePermission("barcodes.lookup");
  const account = captureSyncAccountContext();
  const matches = (await barcodeRepository.findByValue(value.trim())).filter((item) => item.is_active);
  assertSyncAccountCurrent(account);
  const byProduct = new Map<number, ProductBarcode>();
  for (const match of matches) byProduct.set(match.product_id, match);
  if (byProduct.size === 0) return { kind: "unknown" };
  if (byProduct.size > 1) return { kind: "ambiguous" };
  const [productId, barcode] = [...byProduct.entries()][0];
  const product = products.find((item) => item.id === productId && !item.deleted_at && !item.is_hidden);
  return product ? { kind: "unique", product, barcode } : { kind: "unknown" };
}
