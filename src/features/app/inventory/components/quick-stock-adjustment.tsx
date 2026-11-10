import { CubeIcon, MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { Flex } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { useQuickStockAdjustment } from "../hooks/use-quick-stock-adjustment";
import { useAdjustProductQuantity } from "../mutations/use-products";
import type { Product } from "../types";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import {
  getUnitsForOperation,
  packagingOf,
  type QuantityOperationMode,
} from "../domain/packaging";
import { normalizeIntegerText } from "../services/localized-integer";
import { MAX_PRODUCT_QUANTITY, productQuantityError } from "../domain/inventory-quantity";

type Props = { product: Product };

const CONFIRMATION_DEBOUNCE_MS = 1_000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تغییر موجودی ناموفق بود";
}

export function QuickStockAdjustment({ product }: Props) {
  useEntitlementAccess();
  const packaging = packagingOf(product.catalog_product);
  const [operationMode, setOperationMode] =
    useState<QuantityOperationMode>("unit");
  const [pendingDelta, setPendingDelta] = useState(0);
  const [awaitingDecision, setAwaitingDecision] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [quantityDraft, setQuantityDraft] = useState(String(product.quantity));
  const pendingDeltaRef = useRef(0);
  const confirmationTimer = useRef<number | null>(null);
  const mutation = useAdjustProductQuantity();
  const canWrite = accessState.canAccess() && accessState.canWrite();
  const previewQuantity = Math.max(0, product.quantity + pendingDelta);
  const effectiveMode: QuantityOperationMode = packaging.isPackaged
    ? operationMode
    : "unit";
  const operationStep = getUnitsForOperation(
    1,
    effectiveMode,
    packaging.packSize,
  );

  const clearConfirmationTimer = () => {
    if (confirmationTimer.current !== null) {
      window.clearTimeout(confirmationTimer.current);
      confirmationTimer.current = null;
    }
  };

  const resetPreview = () => {
    clearConfirmationTimer();
    pendingDeltaRef.current = 0;
    setPendingDelta(0);
    setAwaitingDecision(false);
    setConfirmationOpen(false);
    setEditingQuantity(false);
    setQuantityDraft(String(product.quantity));
  };

  const beginDirectEdit = () => {
    clearConfirmationTimer();
    setQuantityDraft(previewQuantity === 0 ? "" : String(previewQuantity));
    setEditingQuantity(true);
  };

  const commitDirectQuantity = () => {
    const normalized = normalizeIntegerText(quantityDraft);
    const nextQuantity = normalized === "" ? 0 : Number(normalized);
    const quantityError = productQuantityError(nextQuantity);
    if (quantityError) {
      toast.error(quantityError);
      setQuantityDraft(String(previewQuantity));
      return;
    }
    const nextDelta = nextQuantity - product.quantity;
    setEditingQuantity(false);
    setQuantityDraft(String(nextQuantity));

    if (nextDelta === 0) {
      pendingDeltaRef.current = 0;
      setPendingDelta(0);
      return;
    }

    pendingDeltaRef.current = nextDelta;
    setPendingDelta(nextDelta);
    setAwaitingDecision(true);
    setConfirmationOpen(true);
  };

  const applyStep = (amount: -1 | 1) => {
    const unitDelta = amount * operationStep;
    const next = pendingDeltaRef.current + unitDelta;
    if (product.quantity + next > MAX_PRODUCT_QUANTITY) {
      toast.warning(`حداکثر موجودی هر محصول ${MAX_PRODUCT_QUANTITY.toLocaleString("fa-IR")} عدد است`, {
        id: `max-stock-${product.id}`,
      });
      return;
    }
    if (product.quantity + next < 0) {
      if (effectiveMode === "pack") {
        toast.warning("موجودی برای کم کردن یک بسته کامل کافی نیست", {
          id: `pack-stock-${product.id}`,
        });
      }
      return;
    }
    pendingDeltaRef.current = next;
    setPendingDelta(next);
    if ("vibrate" in navigator) navigator.vibrate?.(6);
  };

  const confirm = (delta: number) => {
    setAwaitingDecision(true);
    mutation.mutate(
      { id: product.id, delta },
      {
        onSuccess: (updated) => {
          resetPreview();
          const name =
            updated.custom_label ?? updated.catalog_product?.name ?? "محصول";
          toast.success(`موجودی «${name}» با موفقیت تغییر کرد.`);
          if ("vibrate" in navigator) navigator.vibrate?.([15, 30, 15]);
        },
        onError: (error) => {
          resetPreview();
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const requestConfirmation = () => {
    const delta = pendingDeltaRef.current;
    if (delta === 0 || awaitingDecision) {
      if (delta === 0) resetPreview();
      return;
    }

    setAwaitingDecision(true);
    setConfirmationOpen(true);
  };

  const scheduleConfirmation = () => {
    clearConfirmationTimer();

    if (pendingDeltaRef.current === 0) {
      resetPreview();
      return;
    }

    confirmationTimer.current = window.setTimeout(() => {
      confirmationTimer.current = null;
      requestConfirmation();
    }, CONFIRMATION_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (confirmationTimer.current !== null) {
        window.clearTimeout(confirmationTimer.current);
      }
    };
  }, []);

  const decrement = useQuickStockAdjustment({
    onRepeat: () => applyStep(-1),
    onFinish: scheduleConfirmation,
  });
  const increment = useQuickStockAdjustment({
    onRepeat: () => applyStep(1),
    onFinish: scheduleConfirmation,
  });

  const busy = !canWrite || awaitingDecision || mutation.isPending;
  const changing = decrement.repeating || increment.repeating;
  const quantityDigitCount = Math.max(
    String(previewQuantity).length,
    editingQuantity ? normalizeIntegerText(quantityDraft).length : 0,
  );
  const quantityLayout = quantityDigitCount >= 4 ? "wide" : "standard";

  return (
    <>
    <Flex
      direction="column"
      gap="2"
      width="100%"
      className="quick-stock-wrapper"
    >
      {packaging.isPackaged && (
        <Flex align="center" gap="2" width="100%" className="quick-stock-mode">
          <SelectInput
            value={operationMode}
            size={{ xs: "3", md: "1" }}
            onValueChange={(value) => {
              resetPreview();
              setOperationMode(value as QuantityOperationMode);
            }}
            options={[
              { label: "تعداد", value: "unit" },
              { label: "بسته", value: "pack" },
            ]}
          />
        </Flex>
      )}
      <Flex
        gap="1"
        dir="ltr"
        align="center"
        justify={"center"}
        aria-label="تنظیم سریع موجودی"
        className="quick-stock-control"
        data-quantity-layout={quantityLayout}
      >
        <Button
          size="3"
          type="button"
          variant="outline"
          data-stock-action="increase"
          disabled={busy}
          aria-label={
            effectiveMode === "pack" ? "افزایش یک بسته" : "افزایش یک واحد"
          }
          {...increment.holdProps}
          className={`quick-stock-button ${increment.pressing ? "is-pressing" : ""} ${increment.repeating ? "is-repeating" : ""}`}
          style={{ touchAction: "pan-y" }}
        >
          <PlusIcon width="17" height="17" />
        </Button>

        <div
          aria-live="polite"
          aria-atomic="true"
          className="quick-stock-quantity"
        >
          {pendingDelta !== 0 && (
            <span
              key={pendingDelta}
              className={`quick-stock-delta ${pendingDelta > 0 ? "is-positive" : "is-negative"}`}
            >
              {pendingDelta > 0 ? "+" : ""}
              {pendingDelta.toLocaleString("fa-IR")}
            </span>
          )}
          {editingQuantity ? (
            <input
              autoFocus
              type="number"
              min="0"
              max={MAX_PRODUCT_QUANTITY}
              inputMode="numeric"
              aria-label="موجودی جدید"
              className="quick-stock-count quick-stock-input"
              value={quantityDraft}
              onChange={(event) => setQuantityDraft(normalizeIntegerText(event.target.value))}
              onBlur={commitDirectQuantity}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDirectQuantity();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingQuantity(false);
                  setQuantityDraft(String(previewQuantity));
                }
              }}
            />
          ) : (
            <button
              type="button"
              className={changing ? "quick-stock-count is-changing" : "quick-stock-count"}
              disabled={busy || pendingDelta !== 0}
              aria-label={`ویرایش مستقیم موجودی ${previewQuantity === 0 ? "صفر" : previewQuantity.toLocaleString("fa-IR")}`}
              onClick={beginDirectEdit}
            >
              {previewQuantity.toLocaleString("fa-IR")}
            </button>
          )}
        </div>

        <Button
          size="3"
          type="button"
          variant="outline"
          data-stock-action="decrease"
          disabled={busy}
          aria-label={
            effectiveMode === "pack" ? "کاهش یک بسته" : "کاهش یک واحد"
          }
          {...decrement.holdProps}
          className={`quick-stock-button ${decrement.pressing ? "is-pressing" : ""} ${decrement.repeating ? "is-repeating" : ""}`}
          style={{ touchAction: "pan-y" }}
        >
          <MinusIcon width="17" height="17" />
        </Button>
      </Flex>
    </Flex>
    <ConfirmDialog
      open={confirmationOpen}
      onOpenChange={(next) => {
        if (!next) resetPreview();
      }}
      title="تغییر موجودی تأیید شود؟"
      description="آیا از تغییر سریع این کالا اطمینان دارید؟"
      icon={<CubeIcon width="22" height="22" />}
      details={
        <div className="stock-confirm-summary" aria-label="خلاصه تغییر موجودی">
          <div>
            <span>موجودی فعلی</span>
            <strong>{product.quantity.toLocaleString("fa-IR")}</strong>
          </div>
          <div className="stock-confirm-change" aria-label={`تغییر ${pendingDelta.toLocaleString("fa-IR")}`}>
            <span>{pendingDelta > 0 ? "+" : ""}{pendingDelta.toLocaleString("fa-IR")}</span>
            <b aria-hidden="true">←</b>
          </div>
          <div>
            <span>موجودی جدید</span>
            <strong>{previewQuantity.toLocaleString("fa-IR")}</strong>
          </div>
          {effectiveMode === "pack" ? (
            <small>
              {(Math.abs(pendingDelta) / operationStep).toLocaleString("fa-IR")} بسته
            </small>
          ) : null}
        </div>
      }
      confirmLabel="تأیید"
      cancelLabel="لغو"
      variant="warning"
      loading={mutation.isPending}
      onConfirm={() => confirm(pendingDeltaRef.current)}
    />
    </>
  );
}
