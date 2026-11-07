import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import { BarcodeCaptureField } from "@/features/barcode/components/barcode-capture-field";
import { accessState } from "@/shared/access/access-state";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { Form } from "@/shared/ui/form/form";
import { Badge, Box, Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoiceRepository } from "./invoice-repository";
import { refreshInvoiceHistory } from "./invoice-history";
import { invoiceService } from "./invoice-service";
import { lookupInvoiceBarcode } from "./invoice-barcode-selection";
import { invoiceOutput } from "./invoice-output";
import type { Invoice, InvoiceCommandLine } from "./types";
import { PageGuide } from "@/features/app/layout/page-guide";
import { FileTextIcon } from "@radix-ui/react-icons";
import { diagnosticErrorCode, userErrorMessage } from "@/shared/lib/presentation/user-error";

type DraftLine = { productId: string; quantity: string; price: string; unit: "unit" | "pack" };
const emptyLine = (): DraftLine => ({ productId: "", quantity: "1", price: "", unit: "unit" });

function toman(value: number | null) { return value == null ? "قابل مشاهده نیست" : `${new Intl.NumberFormat("fa-IR").format(value)} تومان`; }

export function InvoicesPage() {
  const canPost = accessState.hasStorePermission("invoices.post");
  const canPurchase = accessState.canUse("invoices.purchase") && canPost && accessState.hasStorePermission("products.purchase_price.view");
  const canSale = accessState.canUse("invoices.sale") && canPost;
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"purchase" | "sale">(() => accessState.entitlement()?.capabilities["invoices.sale"] === true || canSale ? "sale" : "purchase");
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outputBusy, setOutputBusy] = useState<number | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const lastScan = useRef({ value: "", at: 0 });
  const load = async () => {
    try { await refreshInvoiceHistory(); } catch { /* Keep durable local history available offline or after a transient API failure. */ }
    const [storedProducts, storedInvoices] = await Promise.all([inventoryRepository.getAll(), invoiceRepository.getAll()]);
    setProducts(storedProducts.filter((item) => !item.deleted_at && !item.is_hidden));
    setInvoices(storedInvoices);
  };
  useEffect(() => {
    let active = true;
    void refreshInvoiceHistory().catch(() => undefined).then(() => Promise.all([inventoryRepository.getAll(), invoiceRepository.getAll()])).then(([storedProducts, storedInvoices]) => {
      if (!active) return;
      setProducts(storedProducts.filter((item) => !item.deleted_at && !item.is_hidden));
      setInvoices(storedInvoices);
    });
    return () => { active = false; };
  }, []);
  const total = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0), 0), [lines]);
  const dirty = Boolean(title || counterparty || barcode || lines.some((line) => line.productId || line.price || line.quantity !== "1"));

  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  const stockEffect = (line: DraftLine) => {
    const product = products.find((item) => item.id === Number(line.productId));
    const quantity = Number(line.quantity);
    if (!product || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
    const multiplier = line.unit === "pack" ? product.catalog_product?.pack_size ?? 0 : 1;
    const after = product.quantity + (type === "purchase" ? quantity * multiplier : -quantity * multiplier);
    return `اثر موجودی: ${new Intl.NumberFormat("fa-IR").format(product.quantity)} ← ${new Intl.NumberFormat("fa-IR").format(after)}`;
  };
  const selectProduct = (index: number, value: string) => {
    const product = products.find((item) => item.id === Number(value));
    const suggested = type === "purchase" ? product?.purchase_price : product?.sale_price;
    updateLine(index, { productId: value, price: suggested == null ? "" : String(suggested), unit: "unit" });
  };
  const findBarcode = async (scanned = barcode) => {
    const normalized = scanned.trim();
    if (!normalized) return;
    const now = Date.now();
    if (lastScan.current.value === normalized && now - lastScan.current.at < 1200) return;
    lastScan.current = { value: normalized, at: now };
    try {
      const result = await lookupInvoiceBarcode(normalized, products, type);
      if (result.kind === "unknown") throw new Error("محصولی با این بارکد پیدا نشد");
      if (result.kind === "ambiguous") throw new Error("این بارکد به بیش از یک محصول مرتبط است؛ محصول را دستی انتخاب کنید.");
      const existing = lines.findIndex((line) => Number(line.productId) === result.product.id);
      if (existing >= 0) {
        setHighlightedLine(existing); setTimeout(() => setHighlightedLine(null), 1600);
        document.querySelector<HTMLElement>(`[data-invoice-line="${existing}"]`)?.focus();
      } else {
        const empty = lines.findIndex((line) => !line.productId);
        const target = empty >= 0 ? empty : lines.length;
        if (empty < 0) setLines((current) => [...current, emptyLine()]);
        setTimeout(() => selectProduct(target, String(result.product.id)), 0);
        setHighlightedLine(target); setTimeout(() => setHighlightedLine(null), 1600);
      }
      setBarcode(normalized); setError(null); setErrorCode(null);
    } catch (cause) { setError(userErrorMessage(cause, "خواندن بارکد انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); }
  };
  const runOutput = async (invoice: Invoice, action: "download" | "print" | "share") => {
    setOutputBusy(invoice.id); setError(null); setErrorCode(null);
    try { await invoiceOutput[action](invoice); }
    catch (cause) { setError(userErrorMessage(cause, "ساخت سند انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); }
    finally { setOutputBusy(null); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setErrorCode(null);
    try {
      const payload: InvoiceCommandLine[] = lines.map((line) => {
        const product = products.find((item) => item.id === Number(line.productId));
        return { product_id: Number(line.productId), quantity: Number(line.quantity), unit: line.unit, pack_size: line.unit === "pack" ? product?.catalog_product?.pack_size ?? null : null, unit_price: line.price === "" ? Number.NaN : Number(line.price) };
      });
      await invoiceService.post({ invoice_type: type, title, counterparty, lines: payload });
      setTitle(""); setCounterparty(""); setLines([emptyLine()]); setBarcode(""); await load();
    } catch (cause) { setError(userErrorMessage(cause, "ثبت فاکتور انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); }
    finally { setBusy(false); }
  };

  return <Box dir="rtl" className="mx-auto w-full max-w-5xl space-y-4 px-3 pb-8">
    <PageGuide section="ابزارها" sectionTo="/tools" title="فاکتورها" description="خرید و فروش را با ردیف‌های ثابت ثبت کنید و سند تأییدشده را دریافت یا چاپ کنید." icon={FileTextIcon} helpTopic="invoices" />
    <Text as="p" color="gray">مبالغ به تومان هستند. فاکتور ثبت‌شده و ردیف‌های آن قابل ویرایش نیستند.</Text>
    {!canPurchase && !canSale && <Card><Heading size="4">فاکتورهای تاریخی</Heading><Text as="p" mt="2">طرح فعلی اجازهٔ ثبت، لغو، گزارش یا خروجی فاکتور را نمی‌دهد. سوابق مجاز قبلی فقط برای مشاهده نگه‌داری می‌شوند.</Text></Card>}
    {(canPurchase || canSale) && <Card>
      <Form onSubmit={submit} isSubmitting={busy} isDirty={dirty} className="space-y-4">
        <Flex gap="3" wrap="wrap">
          <label>نوع<br/><select aria-label="نوع فاکتور" value={type} onChange={(event) => { const next = event.target.value as "purchase" | "sale"; setType(next); setLines((current) => current.map((line) => ({ ...line, price: products.find((item) => item.id === Number(line.productId))?.[next === "purchase" ? "purchase_price" : "sale_price"]?.toString() ?? "" }))); }}><option value="sale" disabled={!canSale}>فروش</option><option value="purchase" disabled={!canPurchase}>خرید</option></select></label>
          <label className="min-w-48 flex-1">عنوان<br/><input aria-label="عنوان فاکتور" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200}/></label>
          <label className="min-w-48 flex-1">طرف حساب (اختیاری)<br/><input aria-label="طرف حساب" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} maxLength={200}/></label>
        </Flex>
        {accessState.canUse("barcode.lookup") && accessState.hasStorePermission("barcodes.lookup") && <Flex gap="2" align="end"><label className="flex-1">بارکد برای انتخاب محصول<br/><BarcodeCaptureField key={`${accessState.user()?.id}:${accessState.user()?.store_id}`} value={barcode} onValueChange={setBarcode} onScan={(value) => void findBarcode(value)}/></label><Button type="button" variant="soft" onClick={() => void findBarcode()}>انتخاب</Button></Flex>}
        {lines.map((line, index) => <Card key={index} variant="surface" data-invoice-line={index} tabIndex={-1} className={highlightedLine === index ? "ring-2 ring-amber-400" : undefined}>
          <Flex gap="2" wrap="wrap" align="end">
            <label className="min-w-52 flex-1">محصول<br/><select aria-label={`محصول ردیف ${index + 1}`} value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} required><option value="">انتخاب کنید</option>{products.map((item) => <option key={item.id} value={item.id}>{item.custom_label || item.catalog_product?.name || `#${item.id}`} — موجودی {item.quantity}</option>)}</select></label>
            <label>تعداد<br/><input aria-label={`تعداد ردیف ${index + 1}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })}/></label>
            <label>واحد<br/><select aria-label={`واحد ردیف ${index + 1}`} value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value as "unit" | "pack" })}><option value="unit">عدد</option><option value="pack">بسته</option></select></label>
            <label>قیمت معامله<br/><input aria-label={`قیمت ردیف ${index + 1}`} type="number" min="0" step="1" value={line.price} onChange={(event) => updateLine(index, { price: event.target.value })} required/></label>
            {lines.length > 1 && <Button type="button" color="red" variant="soft" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>حذف ردیف</Button>}
          </Flex>
          {stockEffect(line) && <Text as="p" mt="2" size="2" color="gray">{stockEffect(line)}</Text>}
        </Card>)}
        <Flex justify="between" align="center" wrap="wrap" gap="3"><Button type="button" variant="soft" onClick={() => setLines((current) => [...current, emptyLine()])}>افزودن ردیف</Button><Text weight="bold">جمع: {toman(total)}</Text><Button type="submit" loading={busy}>بررسی و ثبت قطعی</Button></Flex>
        {error && <Box role="alert"><Text as="p" color="red">{error}</Text>{errorCode ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{errorCode}</code></details> : null}</Box>}
      </Form>
    </Card>}
    <Heading size="4">تاریخچه</Heading>
    <div className="grid gap-3 md:grid-cols-2">{invoices.map((invoice) => <Card key={invoice.id}>
      <Flex justify="between" gap="2"><Box><Text weight="bold">{invoice.title}</Text><Text as="div" size="2" color="gray">{invoice.invoice_type === "purchase" ? "خرید" : "فروش"} · {formatJalaliDateTime(invoice.posted_at)}</Text></Box><Badge color={invoice.status === "accepted" ? "green" : invoice.status === "cancelled" ? "gray" : invoice.status === "rejected" || invoice.status === "conflict" ? "red" : "orange"}>{{ accepted: "تأییدشده", cancelled: "باطل‌شده", pending: "ذخیره‌شده روی این دستگاه", cancel_pending: "لغو در انتظار تأیید", rejected: "پذیرفته‌نشده", conflict: "نیازمند بررسی" }[invoice.status]}</Badge></Flex>
      {invoice.counterparty && <Text as="p" mt="2">طرف حساب: {invoice.counterparty}</Text>}
      {invoice.lines.map((line) => <Text as="div" size="2" key={line.product_id}>{line.product_name}: {line.quantity} {line.unit} × {toman(line.unit_price)}</Text>)}
      <Text as="div" weight="bold" mt="2">جمع: {toman(invoice.total_amount)}</Text>
      {accessState.canUse(`invoices.${invoice.invoice_type}`) && accessState.hasStorePermission(invoice.invoice_type === "purchase" ? "products.purchase_price.view" : "products.sale_price.view") && (invoice.status === "accepted" || invoice.status === "cancelled" || (invoice.status === "pending" && accessState.user()?.store_operating_mode === "solo")) && <Flex mt="3" gap="2" wrap="wrap">
        <Button type="button" variant="soft" loading={outputBusy === invoice.id} onClick={() => void runOutput(invoice, "download")}>دریافت PDF</Button>
        <Button type="button" variant="soft" onClick={() => void runOutput(invoice, "print")}>چاپ</Button>
        <Button type="button" variant="soft" onClick={() => void runOutput(invoice, "share")}>اشتراک‌گذاری</Button>
      </Flex>}
      {accessState.canUse(`invoices.${invoice.invoice_type}`) && accessState.hasStorePermission("invoices.cancel") && !(["cancelled", "cancel_pending", "rejected", "conflict"] as string[]).includes(invoice.status) && <Button mt="3" color="red" variant="soft" onClick={async () => { try { await invoiceService.cancel(invoice.id); await load(); } catch (cause) { setError(userErrorMessage(cause, "لغو فاکتور انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); } }}>لغو کامل فاکتور</Button>}
    </Card>)}</div>
  </Box>;
}
