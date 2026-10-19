import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";
import { Button } from "@/shared/ui/button/button";
import { useQuickStockAdjustment } from "../hooks/use-quick-stock-adjustment";
import { useAdjustProductQuantity } from "../mutations/use-products";
import type { Product } from "../types";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import {
  getUnitsForOperation,
  packagingOf,
  type QuantityOperationMode,
} from "../domain/packaging";

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
  const pendingDeltaRef = useRef(0);
  const notificationId = useRef<string | number | null>(null);
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
    notificationId.current = null;
  };

  const applyStep = (amount: -1 | 1) => {
    const unitDelta = amount * operationStep;
    const next = pendingDeltaRef.current + unitDelta;
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
    if (delta === 0 || notificationId.current !== null) {
      if (delta === 0) resetPreview();
      return;
    }

    const finalQuantity = product.quantity + delta;
    let decisionMade = false;
    setAwaitingDecision(true);

    notificationId.current = toast("تغییر موجودی تأیید شود؟", {
      description: `${product.quantity.toLocaleString("fa-IR")} → ${finalQuantity.toLocaleString("fa-IR")} (${delta > 0 ? "+" : ""}${delta.toLocaleString("fa-IR")}${effectiveMode === "pack" ? `، ${(Math.abs(delta) / operationStep).toLocaleString("fa-IR")} بسته` : ""})`,
      duration: Infinity,
      dismissible: true,
      closeButton: false,
      action: {
        label: "تأیید",
        onClick: () => {
          decisionMade = true;
          notificationId.current = null;
          confirm(delta);
        },
      },
      cancel: {
        label: "لغو",
        onClick: () => {
          decisionMade = true;
          resetPreview();
        },
      },
      onDismiss: () => {
        if (!decisionMade) resetPreview();
      },
    });
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
      if (notificationId.current !== null) {
        toast.dismiss(notificationId.current);
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

  return (
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
      >
        <Button
          size="3"
          type="button"
          color="green"
          variant="soft"
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
          <Text
            size="3"
            as="span"
            weight="bold"
            className={
              changing ? "quick-stock-count is-changing" : "quick-stock-count"
            }
          >
            {previewQuantity.toLocaleString("fa-IR")}
          </Text>
        </div>

        <Button
          size="3"
          color="red"
          type="button"
          variant="soft"
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
  );
}
