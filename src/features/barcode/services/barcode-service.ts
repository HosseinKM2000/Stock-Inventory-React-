import { accessState } from "@/shared/access/access-state";
import { createLocalEntityId } from "@/shared/lib/infrastructure/storage/local-entity-id";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import { barcodeLookupCandidates, generateInternalBarcode, inferSymbology, validateBarcode } from "../domain/barcode";
import type { BarcodeMeaning, BarcodeSource, BarcodeSymbology, ProductBarcode } from "../types";
import { barcodeRepository } from "./barcode-repository";

export const BARCODE_ENTITY = "barcode";

export type BarcodeResolution =
  | { status: "found"; barcode: ProductBarcode; productId: number }
  | { status: "unknown" }
  | { status: "ambiguous"; matches: ProductBarcode[] };

async function ensureUnique(value: string, exceptId?: number) {
  const candidates = new Set(barcodeLookupCandidates(value));
  const matches = (await barcodeRepository.getAll()).filter((item) =>
    item.is_active && item.id !== exceptId && barcodeLookupCandidates(item.value, item.symbology).some((candidate) => candidates.has(candidate)),
  );
  if (matches.length) throw new Error("این بارکد در همین فروشگاه به محصول دیگری متصل است");
}

export const barcodeService = {
  async resolve(rawValue: string): Promise<BarcodeResolution> {
    accessState.requireCapability("barcode.lookup");
    accessState.requireStorePermission("barcodes.lookup");
    const symbology = inferSymbology(rawValue);
    const values = barcodeLookupCandidates(rawValue, symbology);
    const matches = (await Promise.all(values.map((value) => barcodeRepository.findByValue(value))))
      .flat()
      .filter((item) => item.is_active);
    const unique = [...new Map(matches.map((item) => [item.id, item])).values()];
    const products = new Set(unique.map((item) => item.product_id));
    if (products.size === 0) return { status: "unknown" };
    if (products.size > 1 || unique.length > 1) return { status: "ambiguous", matches: unique };
    return { status: "found", barcode: unique[0], productId: unique[0].product_id };
  },

  async create(input: {
    productId: number;
    value: string;
    source: BarcodeSource;
    symbology?: BarcodeSymbology;
    meaning: BarcodeMeaning;
    scanQuantity: number;
    isDefault?: boolean;
  }) {
    accessState.requireWrite();
    accessState.requireCapability("barcode.manage");
    accessState.requireStorePermission("barcodes.manage");
    const product = await inventoryRepository.get(input.productId);
    if (!product || product.deleted_at) throw new Error("محصول برای اتصال بارکد در دسترس نیست");
    const symbology = input.symbology ?? inferSymbology(input.value);
    const validation = validateBarcode(input.value, symbology);
    if (!validation.valid) throw new Error(validation.error);
    if (!Number.isSafeInteger(input.scanQuantity) || input.scanQuantity < 1) throw new Error("تعداد هر اسکن نامعتبر است");
    if (input.meaning === "unit" && input.scanQuantity !== 1) throw new Error("بارکد واحد باید دقیقاً یک واحد ثبت کند");
    await ensureUnique(input.value);

    const now = new Date().toISOString();
    const existing = await barcodeRepository.forProduct(input.productId);
    const barcode: ProductBarcode = {
      id: createLocalEntityId(),
      product_id: input.productId,
      value: input.value,
      source: input.source,
      symbology,
      meaning: input.meaning,
      scan_quantity: input.scanQuantity,
      is_active: true,
      is_default: input.isDefault ?? existing.length === 0,
      created_at: now,
      updated_at: now,
    };
    await localMutationStorage.barcode(async () => {
      if (barcode.is_default) {
        for (const current of existing.filter((item) => item.is_default)) {
          const updated = { ...current, is_default: false, updated_at: now };
          await barcodeRepository.save(updated);
          await queueService.enqueue(BARCODE_ENTITY, updated.id, "UPDATE", updated);
        }
      }
      await barcodeRepository.save(barcode);
      await queueService.enqueue(BARCODE_ENTITY, barcode.id, "CREATE", barcode);
    });
    return barcode;
  },

  async generate(productId: number, meaning: BarcodeMeaning, scanQuantity: number) {
    const value = await generateInternalBarcode({ exists: async (candidate) => (await barcodeRepository.findByValue(candidate)).length > 0 });
    return this.create({ productId, value, source: "tanzim", symbology: "code128", meaning, scanQuantity });
  },

  async deactivate(id: number) {
    accessState.requireWrite();
    accessState.requireCapability("barcode.manage");
    accessState.requireStorePermission("barcodes.manage");
    const current = await barcodeRepository.get(id);
    if (!current) throw new Error("بارکد یافت نشد");
    const updated = { ...current, is_active: false, is_default: false, updated_at: new Date().toISOString() };
    await localMutationStorage.barcode(async () => {
      await barcodeRepository.save(updated);
      await queueService.enqueue(BARCODE_ENTITY, id, "UPDATE", updated);
    });
    return updated;
  },

  async setDefault(productId: number, id: number) {
    accessState.requireWrite();
    accessState.requireCapability("barcode.manage");
    accessState.requireStorePermission("barcodes.manage");
    const existing = await barcodeRepository.forProduct(productId);
    const target = existing.find((item) => item.id === id && item.is_active);
    if (!target) throw new Error("بارکد فعال پیدا نشد");
    const now = new Date().toISOString();
    await localMutationStorage.barcode(async () => {
      for (const current of existing) {
        if (current.is_default === (current.id === id)) continue;
        const updated = { ...current, is_default: current.id === id, updated_at: now };
        await barcodeRepository.save(updated);
        await queueService.enqueue(BARCODE_ENTITY, updated.id, "UPDATE", updated);
      }
    });
  },
};
