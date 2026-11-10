import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import { accessState } from "@/shared/access/access-state";
import { createLocalEntityId } from "@/shared/lib/infrastructure/storage/local-entity-id";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { isTeamMode, teamCommandService } from "@/shared/lib/infrastructure/sync/team-command.service";
import { invoiceRepository } from "./invoice-repository";
import type { Invoice, InvoiceCommandLine } from "./types";
import { assertProductQuantity } from "@/features/app/inventory/domain/inventory-quantity";

export const INVOICE_ENTITY = "invoice";

function status(quantity: number, threshold: number) {
  return quantity <= 0 ? "out_of_stock" as const : threshold > 0 && quantity <= threshold ? "low_stock" as const : "in_stock" as const;
}

function validateLines(lines: InvoiceCommandLine[]) {
  if (!lines.length || lines.length > 100) throw new Error("حداقل یک ردیف معتبر لازم است.");
  const consolidated = new Map<number, InvoiceCommandLine>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.product_id)) throw new Error("محصول نامعتبر است.");
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("تعداد باید عدد صحیح مثبت باشد.");
    if (!Number.isSafeInteger(line.unit_price) || line.unit_price < 0) throw new Error("قیمت معامله الزامی و باید نامنفی باشد.");
    if (line.unit === "pack" && (!Number.isSafeInteger(line.pack_size) || (line.pack_size ?? 0) <= 0)) throw new Error("اندازه بسته نامعتبر است.");
    const previous = consolidated.get(line.product_id);
    if (previous) {
      if (previous.unit !== line.unit || previous.unit_price !== line.unit_price || previous.pack_size !== line.pack_size) throw new Error("ردیف تکراری محصول ناسازگار است.");
      previous.quantity += line.quantity;
    } else consolidated.set(line.product_id, { ...line });
  }
  return [...consolidated.values()].sort((a, b) => a.product_id - b.product_id);
}

export const invoiceService = {
  async post(input: { invoice_type: "purchase" | "sale"; title: string; counterparty_id?: number | null; counterparty?: string; lines: InvoiceCommandLine[] }) {
    const user = accessState.user();
    if (!user) throw new Error("برای ثبت فاکتور وارد حساب شوید.");
    accessState.requireCapability(`invoices.${input.invoice_type}`);
    accessState.requireStorePermission("invoices.post");
    if (input.invoice_type === "purchase") accessState.requireStorePermission("products.purchase_price.view");
    const title = input.title.trim();
    if (!title || title.length > 200) throw new Error("عنوان فاکتور الزامی است.");
    const lines = validateLines(input.lines);
    const products = new Map((await inventoryRepository.getAll()).map((item) => [item.id, item]));
    const operationId = crypto.randomUUID();
    const invoiceId = createLocalEntityId();
    const now = new Date().toISOString();
    const snapshots = lines.map((line) => {
      const product = products.get(line.product_id);
      if (!product || product.deleted_at || product.is_hidden) throw new Error("محصول فعال در دسترس نیست.");
      if (line.unit === "pack" && (!product.catalog_product?.is_packaged || product.catalog_product.pack_size !== line.pack_size)) throw new Error("مشخصات بسته با محصول سازگار نیست.");
      const base = line.quantity * (line.pack_size ?? 1);
      const after = product.quantity + (input.invoice_type === "purchase" ? base : -base);
      if (!Number.isSafeInteger(after) || after < 0) throw new Error("موجودی برای ثبت فروش کافی نیست.");
      assertProductQuantity(after);
      return { product, line: { product_id: product.id, product_name: product.custom_label || product.catalog_product?.name || `#${product.id}`, quantity: line.quantity, unit: line.unit === "pack" ? "بسته" as const : "عدد" as const, pack_size: line.pack_size, base_quantity: base, unit_price: line.unit_price, line_total: line.quantity * line.unit_price, before_quantity: product.quantity, after_quantity: after } };
    });
    const invoice: Invoice = { id: invoiceId, invoice_type: input.invoice_type, title, counterparty_id: input.counterparty_id ?? null, counterparty: input.counterparty?.trim() || null, status: "pending", total_amount: snapshots.reduce((sum, item) => sum + item.line.line_total, 0), actor_user_id: user.id, actor_membership_id: user.membership_id ?? null, post_operation_id: operationId, posted_at: now, lines: snapshots.map((item) => item.line) };
    const payload = { invoice_type: input.invoice_type, title, counterparty_id: invoice.counterparty_id, counterparty: invoice.counterparty, lines };
    if (isTeamMode()) {
      if (!navigator.locks) throw new Error("TEAM_LOCKING_UNAVAILABLE");
      if (networkService.isOffline()) throw new Error("TEAM_ONLINE_REQUIRED");
      await localMutationStorage.invoice(async () => {
        await queueService.enqueue(INVOICE_ENTITY, invoiceId, "CREATE", payload, { operationId, forceNew: true, executionMode: "team", policyVersion: user.store_policy_version ?? undefined });
      });
      await teamCommandService.submit(INVOICE_ENTITY, invoiceId, "CREATE", payload, operationId);
      return (await invoiceRepository.get(invoiceId)) ?? invoice;
    }
    await localMutationStorage.invoice(async () => {
      for (const item of snapshots) await inventoryRepository.save({ ...item.product, quantity: item.line.after_quantity, status: status(item.line.after_quantity, item.product.low_stock_threshold), updated_at: now });
      await invoiceRepository.save(invoice);
      await queueService.enqueue(INVOICE_ENTITY, invoiceId, "CREATE", payload, { operationId, forceNew: true });
    });
    return (await invoiceRepository.get(invoiceId)) ?? invoice;
  },

  async cancel(invoiceId: number) {
    const user = accessState.user();
    const invoice = await invoiceRepository.get(invoiceId);
    if (!user || !invoice) throw new Error("فاکتور در دسترس نیست.");
    accessState.requireCapability(`invoices.${invoice.invoice_type}`);
    accessState.requireStorePermission("invoices.cancel");
    if (invoice.status === "cancelled" || invoice.status === "cancel_pending") throw new Error("این فاکتور قبلاً لغو شده یا در انتظار لغو است.");
    const operationId = crypto.randomUUID();
    const effects: Array<{ product: Awaited<ReturnType<typeof inventoryRepository.get>> & {}; before: number; after: number }> = [];
    for (const line of invoice.lines) {
      const product = await inventoryRepository.get(line.product_id);
      if (!product) throw new Error("محصول فاکتور در دسترس نیست.");
      const after = product.quantity + (invoice.invoice_type === "purchase" ? -line.base_quantity : line.base_quantity);
      if (after < 0) throw new Error("موجودی برای برگشت فاکتور خرید کافی نیست.");
      assertProductQuantity(after);
      effects.push({ product, before: product.quantity, after });
    }
    const payload = { action: "cancel", effects: effects.map((value) => ({ product_id: value.product.id, before: value.before, after: value.after })) };
    if (isTeamMode()) {
      if (!navigator.locks) throw new Error("TEAM_LOCKING_UNAVAILABLE");
      if (networkService.isOffline()) throw new Error("TEAM_ONLINE_REQUIRED");
      await localMutationStorage.invoice(async () => {
        await invoiceRepository.save({ ...invoice, status: "cancel_pending", cancel_operation_id: operationId });
        await queueService.enqueue(INVOICE_ENTITY, invoiceId, "UPDATE", payload, { operationId, forceNew: true, executionMode: "team", policyVersion: user.store_policy_version ?? undefined });
      });
      await teamCommandService.submit(INVOICE_ENTITY, invoiceId, "UPDATE", payload, operationId);
      return;
    }
    const now = new Date().toISOString();
    await localMutationStorage.invoice(async () => {
      for (const effect of effects) await inventoryRepository.save({ ...effect.product, quantity: effect.after, status: status(effect.after, effect.product.low_stock_threshold), updated_at: now });
      await invoiceRepository.save({ ...invoice, status: accessState.canUse("sync") ? "cancel_pending" : "cancelled", cancel_operation_id: operationId, cancel_effects: payload.effects });
      await queueService.enqueue(INVOICE_ENTITY, invoiceId, "UPDATE", payload, { operationId, forceNew: true });
    });
  },
};
