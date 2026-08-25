import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { accessState } from "@/shared/access/access-state";
import { Button } from "@/shared/ui/button/button";
import { useQuickStockAdjustment } from "../hooks/use-quick-stock-adjustment";
import { useAdjustProductQuantity } from "../mutations/use-products";
import type { Product } from "../types";

type Props = { product: Product };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "تغییر موجودی ناموفق بود";
}

export function QuickStockAdjustment({ product }: Props) {
  const [pendingDelta, setPendingDelta] = useState(0);
  const [awaitingDecision, setAwaitingDecision] = useState(false);
  const pendingDeltaRef = useRef(0);
  const notificationId = useRef<string | number | null>(null);
  const mutation = useAdjustProductQuantity();
  const canWrite = accessState.canAccess() && accessState.canWrite();
  const previewQuantity = Math.max(0, product.quantity + pendingDelta);

  const resetPreview = useCallback(() => {
    pendingDeltaRef.current = 0;
    setPendingDelta(0);
    setAwaitingDecision(false);
    notificationId.current = null;
  }, []);

  const applyStep = useCallback((amount: -1 | 1) => {
    const next = pendingDeltaRef.current + amount;
    if (product.quantity + next < 0) return;
    pendingDeltaRef.current = next;
    setPendingDelta(next);
    if ("vibrate" in navigator) navigator.vibrate?.(6);
  }, [product.quantity]);

  const confirm = useCallback((delta: number) => {
    setAwaitingDecision(true);
    mutation.mutate(
      { id: product.id, delta },
      {
        onSuccess: (updated) => {
          resetPreview();
          const name = updated.custom_label ?? updated.catalog_product?.name ?? "محصول";
          toast.success(`موجودی «${name}» با موفقیت تغییر کرد.`);
          if ("vibrate" in navigator) navigator.vibrate?.([15, 30, 15]);
        },
        onError: (error) => {
          resetPreview();
          toast.error(errorMessage(error));
        },
      },
    );
  }, [mutation, product.id, resetPreview]);

  const requestConfirmation = useCallback(() => {
    const delta = pendingDeltaRef.current;
    if (delta === 0 || notificationId.current !== null) {
      if (delta === 0) resetPreview();
      return;
    }

    const finalQuantity = product.quantity + delta;
    let decisionMade = false;
    setAwaitingDecision(true);

    notificationId.current = toast("تغییر موجودی تأیید شود؟", {
      description: `${product.quantity.toLocaleString("fa-IR")} → ${finalQuantity.toLocaleString("fa-IR")} (${delta > 0 ? "+" : ""}${delta.toLocaleString("fa-IR")})`,
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
  }, [confirm, product.quantity, resetPreview]);

  const decrement = useQuickStockAdjustment({
    onRepeat: () => applyStep(-1),
    onFinish: requestConfirmation,
  });
  const increment = useQuickStockAdjustment({
    onRepeat: () => applyStep(1),
    onFinish: requestConfirmation,
  });

  const busy = !canWrite || awaitingDecision || mutation.isPending;
  const changing = decrement.repeating || increment.repeating;

  return (
    <Flex
      align="center"
      gap="1"
      dir="ltr"
      className="quick-stock-control"
      aria-label="تنظیم سریع موجودی"
    >
      <Button
        type="button"
        size="2"
        variant="soft"
        color="red"
        disabled={busy}
        aria-label="برای کاهش یکی کلیک کنید یا برای کاهش سریع نگه دارید"
        {...decrement.holdProps}
        className={`quick-stock-button ${decrement.pressing ? "is-pressing" : ""} ${decrement.repeating ? "is-repeating" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        <MinusIcon width="17" height="17" />
      </Button>

      <div className="quick-stock-quantity" aria-live="polite" aria-atomic="true">
        {pendingDelta !== 0 && (
          <span
            key={pendingDelta}
            className={`quick-stock-delta ${pendingDelta > 0 ? "is-positive" : "is-negative"}`}
          >
            {pendingDelta > 0 ? "+" : ""}{pendingDelta.toLocaleString("fa-IR")}
          </span>
        )}
        <Text as="span" size="3" weight="bold" className={changing ? "quick-stock-count is-changing" : "quick-stock-count"}>
          {previewQuantity.toLocaleString("fa-IR")}
        </Text>
      </div>

      <Button
        type="button"
        size="2"
        variant="soft"
        color="green"
        disabled={busy}
        aria-label="برای افزایش یکی کلیک کنید یا برای افزایش سریع نگه دارید"
        {...increment.holdProps}
        className={`quick-stock-button ${increment.pressing ? "is-pressing" : ""} ${increment.repeating ? "is-repeating" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        <PlusIcon width="17" height="17" />
      </Button>
    </Flex>
  );
}
