import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import { accessState } from "@/shared/access/access-state";
import { createLocalEntityId } from "@/shared/lib/infrastructure/storage/local-entity-id";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import type { InventoryMovement, InventoryMovementKind, ProductBarcode, ScanInputSource } from "../types";
import { movementRepository } from "./movement-repository";

export const INVENTORY_MOVEMENT_ENTITY = "inventory_movement";

function quantityStatus(quantity: number, threshold: number) {
  if (quantity <= 0) return "out_of_stock" as const;
  if (threshold > 0 && quantity <= threshold) return "low_stock" as const;
  return "in_stock" as const;
}

export const movementService = {
  async commit(input: {
    productId: number;
    kind: Exclude<InventoryMovementKind, "reversal">;
    units?: number;
    finalQuantity?: number;
    source: ScanInputSource;
    barcode?: ProductBarcode | null;
  }) {
    accessState.requireWrite();
    accessState.requireCapability("barcode.lookup");
    accessState.requireStorePermission("barcodes.lookup");
    accessState.requireStorePermission("products.quantity.change");
    const user = accessState.user();
    if (!user) throw new Error("برای تغییر موجودی باید وارد حساب شوید");
    const current = await inventoryRepository.get(input.productId);
    if (!current || current.deleted_at || current.is_hidden) throw new Error("محصول برای تغییر موجودی فعال نیست");

    const scanQuantity = input.barcode?.scan_quantity ?? 1;
    const scans = input.units ?? 1;
    if (!Number.isSafeInteger(scans) || scans < 1) throw new Error("تعداد اسکن باید عدد صحیح مثبت باشد");
    const amount = scans * scanQuantity;
    if (!Number.isSafeInteger(amount)) throw new Error("مقدار تغییر موجودی از محدوده مجاز خارج است");
    const before = current.quantity;
    const after = input.kind === "correction"
      ? input.finalQuantity
      : before + (input.kind === "receive" ? amount : -amount);
    if (after == null || !Number.isSafeInteger(after) || after < 0) throw new Error("موجودی نهایی نمی‌تواند منفی یا نامعتبر باشد");
    const delta = after - before;
    if (delta === 0) throw new Error("این عملیات موجودی را تغییر نمی‌دهد");

    const now = new Date().toISOString();
    const operationId = crypto.randomUUID();
    const movement: InventoryMovement = {
      id: createLocalEntityId(),
      operation_id: operationId,
      product_id: current.id,
      actor_user_id: user.id,
      actor_membership_id: user.membership_id ?? null,
      kind: input.kind,
      delta,
      correction_quantity: input.kind === "correction" ? after : null,
      scan_source: input.source,
      barcode_id: input.barcode?.id ?? null,
      barcode_value: input.barcode?.value ?? null,
      scan_quantity: scanQuantity,
      before_quantity: before,
      after_quantity: after,
      reverses_operation_id: null,
      sync_status: "pending",
      created_at: now,
      updated_at: now,
    };
    await localMutationStorage.movement(async () => {
      await inventoryRepository.save({
        ...current,
        quantity: after,
        status: quantityStatus(after, current.low_stock_threshold),
        updated_at: now,
      });
      await movementRepository.save(movement);
      await queueService.enqueue(INVENTORY_MOVEMENT_ENTITY, movement.id, "CREATE", movement, { operationId });
    });
    return movement;
  },

  async undo(operationId: string) {
    const original = await movementRepository.byOperationId(operationId);
    if (!original || original.sync_status === "rejected") throw new Error("عملیات اصلی برای بازگردانی در دسترس نیست");
    if (original.sync_status === "conflict") throw new Error("عملیات ردشده قابل بازگردانی نیست");
    const movements = await movementRepository.getAll();
    if (movements.some((item) => item.reverses_operation_id === operationId)) throw new Error("این عملیات قبلاً بازگردانی شده است");
    const user = accessState.user();
    const current = await inventoryRepository.get(original.product_id);
    if (!user || !current) throw new Error("محصول برای بازگردانی در دسترس نیست");
    const after = current.quantity - original.delta;
    if (after < 0) throw new Error("بازگردانی باعث موجودی منفی می‌شود");
    const now = new Date().toISOString();
    const reversalOperationId = crypto.randomUUID();
    const reversal: InventoryMovement = {
      ...original,
      id: createLocalEntityId(),
      operation_id: reversalOperationId,
      actor_user_id: user.id,
      actor_membership_id: user.membership_id ?? null,
      kind: "reversal",
      delta: -original.delta,
      correction_quantity: null,
      before_quantity: current.quantity,
      after_quantity: after,
      reverses_operation_id: original.operation_id,
      sync_status: "pending",
      created_at: now,
      updated_at: now,
    };
    await localMutationStorage.movement(async () => {
      await inventoryRepository.save({ ...current, quantity: after, status: quantityStatus(after, current.low_stock_threshold), updated_at: now });
      await movementRepository.save(reversal);
      await queueService.enqueue(INVENTORY_MOVEMENT_ENTITY, reversal.id, "CREATE", reversal, { operationId: reversalOperationId });
    });
    return reversal;
  },
};
