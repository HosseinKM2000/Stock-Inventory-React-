import {
  Badge,
  Box,
  Callout,
  Card,
  Dialog,
  Flex,
  Grid,
  Select,
  SegmentedControl,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import { CameraIcon, CheckCircledIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { accessState } from "@/shared/access/access-state";
import { Button } from "@/shared/ui/button/button";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import { sanitizeScannedValue } from "../domain/barcode";
import { CameraDuplicateGate } from "../input/camera-duplicate-gate";
import { startCameraScanner, type CameraSession } from "../input/camera-scanner";
import { completedHardwareScan } from "../input/hardware-input";
import { barcodeService } from "../services/barcode-service";
import { movementService } from "../services/movement-service";
import type { InventoryMovement, ProductBarcode, ScanInputSource } from "../types";

type ScannerMode = "observe" | "receive" | "issue" | "correction" | "edit";
type LocatedProduct = { product: Product; barcode: ProductBarcode };

const MODE_LABELS: Record<ScannerMode, string> = {
  observe: "مشاهده",
  receive: "ورود موجودی",
  issue: "خروج موجودی",
  correction: "اصلاح موجودی",
  edit: "ویرایش محصول",
};

function productName(product: Product) {
  return product.custom_label || product.catalog_product?.name || "محصول بدون نام";
}

export function ScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const duplicateGate = useRef(new CameraDuplicateGate());
  const inputRef = useRef<HTMLInputElement>(null);
  const scanHandlerRef = useRef<(value: string, source: ScanInputSource) => Promise<void>>(async () => undefined);
  const [mode, setMode] = useState<ScannerMode>("observe");
  const [input, setInput] = useState("");
  const [located, setLocated] = useState<LocatedProduct | null>(null);
  const [unresolved, setUnresolved] = useState<{ value: string; kind: "unknown" | "ambiguous" } | null>(null);
  const [pending, setPending] = useState<LocatedProduct | null>(null);
  const [lastMovement, setLastMovement] = useState<InventoryMovement | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [finalQuantity, setFinalQuantity] = useState("");
  const [continuous, setContinuous] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkProducts, setLinkProducts] = useState<Product[]>([]);
  const [linkProductId, setLinkProductId] = useState("");
  const canChangeQuantity = accessState.canWrite() && accessState.hasStorePermission("products.quantity.change");
  const canEdit = accessState.canWrite() && accessState.hasStorePermission("products.edit");

  const stopCamera = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    duplicateGate.current.rearm();
    setCameraActive(false);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cameraRef.current?.stop();
    };
  }, [stopCamera]);

  const commitMovement = useCallback(async (target: LocatedProduct, source: ScanInputSource) => {
    if (mode === "observe" || mode === "edit") return;
    const units = Number(quantity);
    const correction = Number(finalQuantity);
    setBusy(true);
    try {
      const movement = await movementService.commit({
        productId: target.product.id,
        kind: mode,
        units,
        finalQuantity: mode === "correction" ? correction : undefined,
        source,
        barcode: target.barcode,
      });
      setLastMovement(movement);
      const refreshed = await inventoryRepository.get(target.product.id);
      if (refreshed) setLocated({ ...target, product: refreshed });
      setPending(null);
      setFinalQuantity("");
      toast.success(`موجودی ${productName(target.product)} به ${movement.after_quantity} رسید`);
      if (feedbackEnabled && navigator.vibrate) navigator.vibrate(40);
      if (feedbackEnabled) {
        try {
          const AudioContextClass = window.AudioContext;
          const context = new AudioContextClass();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.value = 0.035;
          oscillator.frequency.value = 720;
          oscillator.connect(gain).connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.07);
          oscillator.addEventListener("ended", () => void context.close(), { once: true });
        } catch { /* Audio feedback is optional and may be blocked by the browser. */ }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت تغییر موجودی ناموفق بود");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [feedbackEnabled, finalQuantity, mode, quantity]);

  const handleScan = useCallback(async (rawValue: string, source: ScanInputSource) => {
    const value = sanitizeScannedValue(rawValue);
    if (!value || busy) return;
    setBusy(true);
    setCameraError(null);
    try {
      const resolution = await barcodeService.resolve(value);
      if (resolution.status === "unknown") {
        setLocated(null);
        setUnresolved({ value, kind: "unknown" });
        toast.error("این بارکد به محصولی متصل نیست");
        return;
      }
      if (resolution.status === "ambiguous") {
        setLocated(null);
        setUnresolved({ value, kind: "ambiguous" });
        toast.error("بارکد مبهم است؛ اتصال‌های تکراری را بررسی کنید");
        return;
      }
      const product = await inventoryRepository.get(resolution.productId);
      if (!product || product.deleted_at || product.is_hidden) {
        setLocated(null);
        toast.error("محصول حذف یا مخفی شده و قابل عملیات نیست");
        return;
      }
      const target = { product, barcode: resolution.barcode };
      setLocated(target);
      setUnresolved(null);
      setInput("");
      if (mode === "observe") return;
      if (mode === "edit") {
        void navigate({ to: "/inventory/edit", search: { id: product.id } });
        return;
      }
      if (continuous && (mode === "receive" || mode === "issue")) {
        setBusy(false);
        await commitMovement(target, source);
      } else {
        setPending(target);
        if (mode === "correction") setFinalQuantity(String(product.quantity));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خواندن بارکد ناموفق بود");
    } finally {
      setBusy(false);
    }
  }, [busy, commitMovement, continuous, mode, navigate]);
  useEffect(() => {
    scanHandlerRef.current = handleScan;
  }, [handleScan]);

  const startCamera = async () => {
    if (!videoRef.current || cameraRef.current) return;
    setCameraError(null);
    try {
      cameraRef.current = await startCameraScanner(
        videoRef.current,
        (value) => {
          if (duplicateGate.current.observe(value)) void scanHandlerRef.current(value, "camera");
        },
        () => duplicateGate.current.absent(),
      );
      setCameraActive(true);
    } catch (error) {
      stopCamera();
      setCameraError(error instanceof Error ? error.message : "دسترسی به دوربین ممکن نیست");
    }
  };

  const openLink = async () => {
    const products = (await inventoryRepository.getAll()).filter((product) => !product.deleted_at && !product.is_hidden);
    setLinkProducts(products);
    setLinkProductId(products[0] ? String(products[0].id) : "");
    setLinkOpen(true);
  };

  const linkUnknown = async () => {
    if (!unresolved || unresolved.kind !== "unknown" || !linkProductId) return;
    setBusy(true);
    try {
      await barcodeService.create({ productId: Number(linkProductId), value: unresolved.value, source: "manufacturer", meaning: "unit", scanQuantity: 1 });
      setLinkOpen(false);
      toast.success("بارکد به محصول متصل شد");
      setBusy(false);
      await handleScan(unresolved.value, "manual");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "اتصال بارکد ناموفق بود");
    } finally { setBusy(false); }
  };

  const submitInput = (source: ScanInputSource = "manual") => void handleScan(input, source);
  const parsedQuantity = Number(quantity);
  const unitDelta = pending ? parsedQuantity * pending.barcode.scan_quantity : 0;
  const nextQuantity = pending
    ? mode === "receive" ? pending.product.quantity + unitDelta
      : mode === "issue" ? pending.product.quantity - unitDelta
        : Number(finalQuantity)
    : 0;

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 lg:py-8">
      <Flex direction="column" gap="5">
        <Box>
          <Text as="div" size="6" weight="bold">اسکن بارکد</Text>
          <Text as="div" color="gray" size="2" mt="1">جست‌وجو یا ثبت گردش موجودی، حتی هنگام قطع اینترنت</Text>
        </Box>

        <SegmentedControl.Root value={mode} onValueChange={(value) => {
          const next = value as ScannerMode;
          setMode(next);
          if (next === "observe" || next === "correction" || next === "edit") setContinuous(false);
        }} className="w-full sm:w-fit">
          <SegmentedControl.Item value="observe">مشاهده</SegmentedControl.Item>
          {canChangeQuantity ? <SegmentedControl.Item value="receive">ورود</SegmentedControl.Item> : null}
          {canChangeQuantity ? <SegmentedControl.Item value="issue">خروج</SegmentedControl.Item> : null}
          {canChangeQuantity ? <SegmentedControl.Item value="correction">اصلاح</SegmentedControl.Item> : null}
          {canEdit ? <SegmentedControl.Item value="edit">ویرایش</SegmentedControl.Item> : null}
        </SegmentedControl.Root>

        <Grid columns={{ initial: "1", md: "2" }} gap="5" align="start">
          <Card size="3">
            <Flex direction="column" gap="4">
              <Flex justify="between" align="center" gap="3" wrap="wrap">
                <Box>
                  <Text as="div" weight="bold">ورودی اسکنر</Text>
                  <Text as="div" size="1" color="gray">اسکنر دستی، ورود شماره یا دوربین</Text>
                </Box>
                <Badge color={cameraActive ? "green" : "gray"} variant="soft">
                  {cameraActive ? "دوربین فعال" : "دوربین خاموش"}
                </Badge>
              </Flex>

              <Flex gap="2" align="stretch">
                <TextField.Root
                  ref={inputRef}
                  autoFocus
                  size="3"
                  value={input}
                  placeholder="بارکد را اسکن یا وارد کنید"
                  aria-label="بارکد"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    const value = completedHardwareScan(event.nativeEvent, input);
                    if (value) void handleScan(value, "hardware");
                  }}
                  className="min-w-0 flex-1"
                >
                  <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
                </TextField.Root>
                <Button variant="soft" disabled={!sanitizeScannedValue(input) || busy} onClick={() => submitInput()}>
                  بررسی
                </Button>
              </Flex>

              <Box className="relative min-h-52 overflow-hidden rounded-3xl bg-[var(--gray-3)]">
                <video ref={videoRef} muted playsInline className="aspect-video h-full w-full object-cover" />
                {!cameraActive ? (
                  <Flex position="absolute" inset="0" align="center" justify="center" direction="column" gap="3">
                    <CameraIcon width="28" height="28" />
                    <Button variant="soft" onClick={() => void startCamera()} leftIcon={<CameraIcon />}>
                      فعال‌کردن دوربین
                    </Button>
                  </Flex>
                ) : (
                  <Flex className="absolute left-3 top-3" gap="2">
                    <Button size="2" color="gray" variant="solid" onClick={() => duplicateGate.current.rearm()}>اسکن دوباره</Button>
                    <Button size="2" color="gray" variant="solid" onClick={stopCamera} leftIcon={<Cross2Icon />}>توقف</Button>
                  </Flex>
                )}
              </Box>

              {cameraError ? <Callout.Root color="red" role="alert"><Callout.Text>{cameraError}</Callout.Text></Callout.Root> : null}

              {mode !== "observe" && mode !== "edit" ? (
                <Flex direction={{ initial: "column", sm: "row" }} gap="4" justify="between">
                  <label>
                    <Text as="div" size="2" weight="medium" mb="1">تعداد اسکن</Text>
                    <TextField.Root type="number" inputMode="numeric" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                  </label>
                  {mode === "receive" || mode === "issue" ? (
                    <Text as="label" size="2" className="flex items-center gap-2">
                      <Switch checked={continuous} onCheckedChange={setContinuous} />
                      ثبت پیوسته بدون تأیید
                    </Text>
                  ) : null}
                  <Text as="label" size="2" className="flex items-center gap-2"><Switch checked={feedbackEnabled} onCheckedChange={setFeedbackEnabled} /> صدا/لرزش</Text>
                </Flex>
              ) : null}
              {continuous ? <Callout.Root color="amber"><Callout.Text><Flex align="center" justify="between" gap="3"><span>جلسه پیوسته فعال است؛ هر اسکن معتبر فوراً موجودی را تغییر می‌دهد.</span><Button type="button" size="1" color="amber" variant="outline" onClick={() => setContinuous(false)}>توقف جلسه</Button></Flex></Callout.Text></Callout.Root> : null}
            </Flex>
          </Card>

          <Card size="3" className="min-h-64">
            {located ? (
              <Flex direction="column" gap="4">
                <Flex justify="between" align="start" gap="3">
                  <Box>
                    <Text as="div" size="5" weight="bold">{productName(located.product)}</Text>
                    <Text as="div" size="2" color="gray" mt="1">{located.barcode.value}</Text>
                  </Box>
                  <Badge color="green"><CheckCircledIcon /> پیدا شد</Badge>
                </Flex>
                <Grid columns="2" gap="3">
                  <Box className="rounded-2xl bg-[var(--gray-2)] p-4">
                    <Text as="div" size="1" color="gray">موجودی</Text>
                    <Text as="div" size="6" weight="bold">{located.product.quantity.toLocaleString("fa-IR")}</Text>
                  </Box>
                  <Box className="rounded-2xl bg-[var(--gray-2)] p-4">
                    <Text as="div" size="1" color="gray">مقدار هر اسکن</Text>
                    <Text as="div" size="6" weight="bold">{located.barcode.scan_quantity.toLocaleString("fa-IR")}</Text>
                  </Box>
                </Grid>
                <Text size="2" color="gray">
                  نوع بارکد: {located.barcode.meaning === "package" ? "بسته" : "واحد"} · {located.barcode.symbology.toUpperCase()}
                </Text>
                {lastMovement?.product_id === located.product.id ? <Flex gap="2" wrap="wrap"><Badge color="green">ذخیره محلی انجام شد</Badge><Badge color={lastMovement.sync_status === "accepted" ? "green" : "amber"}>{lastMovement.sync_status === "accepted" ? "پذیرفته سرور" : "همگام‌سازی در صف"}</Badge></Flex> : null}
                {lastMovement?.product_id === located.product.id && lastMovement.kind !== "reversal" ? <Button variant="ghost" color="amber" onClick={() => void movementService.undo(lastMovement.operation_id).then(async (reversal) => {
                  const refreshed = await inventoryRepository.get(located.product.id);
                  if (refreshed) setLocated({ ...located, product: refreshed });
                  setLastMovement(reversal);
                  toast.success("عملیات با یک گردش جبرانی بازگردانده شد");
                }).catch((error) => toast.error(error instanceof Error ? error.message : "بازگردانی ناموفق بود"))}>بازگردانی آخرین عملیات</Button> : null}
                <Button variant="soft" onClick={() => void navigate({ to: "/inventory/edit", search: { id: located.product.id } })}>
                  ویرایش محصول
                </Button>
              </Flex>
            ) : unresolved ? (
              <Flex minHeight="240px" direction="column" align="center" justify="center" gap="3" className="text-center">
                <Text weight="bold">{unresolved.kind === "unknown" ? "بارکد در داده محلی پیدا نشد" : "بارکد به‌صورت مبهم ثبت شده است"}</Text>
                <Text size="2" color="gray" dir="ltr">{unresolved.value}</Text>
                <Text size="1" color="gray">{unresolved.kind === "unknown" && !navigator.onLine ? "آفلاین هستید؛ ممکن است این کد هنوز روی این دستگاه همگام نشده باشد." : "تا رفع اتصال تکراری، هیچ تغییری در موجودی انجام نمی‌شود."}</Text>
                {unresolved.kind === "unknown" && canEdit ? <Flex gap="2" wrap="wrap" justify="center">
                  <Button variant="outline" color="green" onClick={() => void navigate({ to: "/inventory/add" })}>ساخت محصول</Button>
                  <Button variant="soft" onClick={() => void openLink()}>اتصال به محصول موجود</Button>
                </Flex> : null}
              </Flex>
            ) : (
              <Flex minHeight="240px" direction="column" align="center" justify="center" gap="2" className="text-center">
                <MagnifyingGlassIcon width="30" height="30" />
                <Text weight="bold">منتظر اسکن بارکد</Text>
                <Text size="2" color="gray">اطلاعات اصلی محصول اینجا نمایش داده می‌شود.</Text>
              </Flex>
            )}
          </Card>
        </Grid>
      </Flex>

      <Dialog.Root open={Boolean(pending)} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
        <Dialog.Content maxWidth="430px" aria-describedby="movement-description">
          <Dialog.Title weight="bold">تأیید {MODE_LABELS[mode]}</Dialog.Title>
          <Dialog.Description id="movement-description" size="2" color="gray">
            {pending ? productName(pending.product) : ""}
          </Dialog.Description>
          {pending ? (
            <Flex direction="column" gap="4" mt="5">
              {mode === "correction" ? (
                <label>
                  <Text as="div" size="2" weight="medium" mb="2">موجودی نهایی</Text>
                  <TextField.Root autoFocus type="number" inputMode="numeric" min="0" value={finalQuantity} onChange={(event) => setFinalQuantity(event.target.value)} />
                </label>
              ) : null}
              <Grid columns="3" gap="2" className="rounded-2xl bg-[var(--gray-2)] p-3 text-center">
                <Box><Text as="div" size="1" color="gray">فعلی</Text><Text weight="bold">{pending.product.quantity.toLocaleString("fa-IR")}</Text></Box>
                <Box><Text as="div" size="1" color="gray">تغییر</Text><Text weight="bold">{mode === "correction" ? "←" : `${mode === "receive" ? "+" : "−"}${unitDelta.toLocaleString("fa-IR")}`}</Text></Box>
                <Box><Text as="div" size="1" color="gray">جدید</Text><Text weight="bold">{Number.isFinite(nextQuantity) ? nextQuantity.toLocaleString("fa-IR") : "—"}</Text></Box>
              </Grid>
              <Flex gap="3" justify="end" mt="2">
                <Dialog.Close><Button color="gray" variant="soft" disabled={busy}>لغو</Button></Dialog.Close>
                <Button
                  intent="positive"
                  variant="outline"
                  color="green"
                  loading={busy}
                  disabled={!Number.isSafeInteger(nextQuantity) || nextQuantity < 0}
                  onClick={() => void commitMovement(pending, "manual")}
                >
                  تأیید
                </Button>
              </Flex>
            </Flex>
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={linkOpen} onOpenChange={setLinkOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title weight="bold">اتصال بارکد به محصول</Dialog.Title>
          <Dialog.Description color="gray">این کد به‌عنوان بارکد یک‌واحدی ذخیره می‌شود؛ تنظیم بسته را بعداً در ویرایش محصول انجام دهید.</Dialog.Description>
          <Flex direction="column" gap="4" mt="5">
            <Select.Root value={linkProductId} onValueChange={setLinkProductId}><Select.Trigger placeholder="انتخاب محصول" /><Select.Content>{linkProducts.map((product) => <Select.Item key={product.id} value={String(product.id)}>{productName(product)}</Select.Item>)}</Select.Content></Select.Root>
            <Flex justify="end" gap="3"><Dialog.Close><Button color="gray" variant="soft">لغو</Button></Dialog.Close><Button intent="positive" color="green" variant="outline" disabled={!linkProductId} loading={busy} onClick={() => void linkUnknown()}>اتصال</Button></Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
