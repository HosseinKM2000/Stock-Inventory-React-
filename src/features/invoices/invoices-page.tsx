import { PageGuide } from "@/features/app/layout/page-guide";
import { inventoryRepository } from "@/features/app/inventory/services/inventory.repository";
import type { Product } from "@/features/app/inventory/types";
import { BarcodeCaptureField } from "@/features/barcode/components/barcode-capture-field";
import { counterpartiesApi, counterpartyKeys } from "@/features/counterparties/api";
import { accessState } from "@/shared/access/access-state";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { useOnline } from "@/shared/lib/infrastructure/sync/use-sync-status";
import { diagnosticErrorCode, userErrorMessage } from "@/shared/lib/presentation/user-error";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Form } from "@/shared/ui/form/form";
import { CheckIcon, CubeIcon, FileTextIcon, MagnifyingGlassIcon, MinusIcon, PlusIcon, ReaderIcon, Share2Icon, TrashIcon } from "@radix-ui/react-icons";
import { Badge, Box, Card, Dialog, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { lookupInvoiceBarcode } from "./invoice-barcode-selection";
import { refreshInvoiceHistory } from "./invoice-history";
import { invoiceOutput } from "./invoice-output";
import { invoiceRepository } from "./invoice-repository";
import { invoiceService } from "./invoice-service";
import type { Invoice, InvoiceCommandLine } from "./types";

type DraftLine = { productId: string; quantity: string; price: string; unit: "unit" | "pack" };
const emptyLine = (): DraftLine => ({ productId: "", quantity: "1", price: "", unit: "unit" });
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const toman = (value: number | null) => value == null ? "قابل مشاهده نیست" : `${number(value)} تومان`;
const canUseInvoiceOutput = (invoice: Invoice) => accessState.canUse(`invoices.${invoice.invoice_type}`)
  && accessState.hasStorePermission(invoice.invoice_type === "purchase" ? "products.purchase_price.view" : "products.sale_price.view")
  && (invoice.status === "accepted" || invoice.status === "cancelled" || (invoice.status === "pending" && accessState.user()?.store_operating_mode === "solo"));

export function InvoicesPage() {
  const online = useOnline();
  const canPost = accessState.hasStorePermission("invoices.post");
  const canPurchase = accessState.canUse("invoices.purchase") && canPost && accessState.hasStorePermission("products.purchase_price.view");
  const canSale = accessState.canUse("invoices.sale") && canPost;
  const parties = useQuery({
    queryKey: counterpartyKeys.all,
    queryFn: counterpartiesApi.list,
    enabled: online && accessState.hasStorePermission("counterparties.view"),
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [type, setType] = useState<"purchase" | "sale">(() => canSale ? "sale" : "purchase");
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outputBusy, setOutputBusy] = useState<number | null>(null);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<Invoice | null>(null);
  const lastScan = useRef({ value: "", at: 0 });

  const load = async () => {
    try { await refreshInvoiceHistory(); } catch { /* local history remains available */ }
    const [storedProducts, storedInvoices] = await Promise.all([inventoryRepository.getAll(), invoiceRepository.getAll()]);
    setProducts(storedProducts.filter((item) => !item.deleted_at && !item.is_hidden));
    setInvoices(storedInvoices);
  };
  useEffect(() => {
    let active = true;
    void refreshInvoiceHistory().catch(() => undefined)
      .then(() => Promise.all([inventoryRepository.getAll(), invoiceRepository.getAll()]))
      .then(([storedProducts, storedInvoices]) => {
        if (!active) return;
        setProducts(storedProducts.filter((item) => !item.deleted_at && !item.is_hidden));
        setInvoices(storedInvoices);
      });
    return () => { active = false; };
  }, []);

  const total = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0), 0), [lines]);
  const totalItems = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0), [lines]);
  const completedLines = lines.filter((line) => line.productId && Number(line.quantity) > 0 && line.price !== "").length;
  const dirty = Boolean(title || counterparty || barcode || lines.some((line) => line.productId || line.price || line.quantity !== "1"));

  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...patch } : line));
  const selectProduct = (index: number, value: string) => {
    const product = products.find((item) => item.id === Number(value));
    const suggested = type === "purchase" ? product?.purchase_price : product?.sale_price;
    updateLine(index, { productId: value, price: suggested == null ? "" : String(suggested), unit: "unit" });
  };
  const changeQuantity = (index: number, delta: number) => updateLine(index, { quantity: String(Math.max(1, (Number(lines[index].quantity) || 1) + delta)) });
  const setInvoiceType = (next: "purchase" | "sale") => {
    setType(next);
    setLines((current) => current.map((line) => ({
      ...line,
      price: products.find((item) => item.id === Number(line.productId))?.[next === "purchase" ? "purchase_price" : "sale_price"]?.toString() ?? "",
    })));
  };
  const chooseCounterparty = (value: string) => {
    setCounterparty(value);
    const matches = (parties.data ?? []).filter((item) => item.name === value);
    setCounterpartyId(matches.length === 1 ? matches[0].id : null);
  };
  const buildPayload = (): InvoiceCommandLine[] => lines.map((line) => {
    const product = products.find((item) => item.id === Number(line.productId));
    return {
      product_id: Number(line.productId),
      quantity: Number(line.quantity),
      unit: line.unit,
      pack_size: line.unit === "pack" ? product?.catalog_product?.pack_size ?? null : null,
      unit_price: line.price === "" ? Number.NaN : Number(line.price),
    };
  });

  const findBarcode = async (scanned = barcode) => {
    const normalized = scanned.trim();
    if (!normalized) return;
    const now = Date.now();
    if (lastScan.current.value === normalized && now - lastScan.current.at < 1200) return;
    lastScan.current = { value: normalized, at: now };
    try {
      const result = await lookupInvoiceBarcode(normalized, products, type);
      if (result.kind === "unknown") throw new Error("محصولی با این بارکد پیدا نشد");
      if (result.kind === "ambiguous") throw new Error("این بارکد چند محصول دارد؛ محصول را دستی انتخاب کنید.");
      const existing = lines.findIndex((line) => Number(line.productId) === result.product.id);
      const empty = lines.findIndex((line) => !line.productId);
      const target = existing >= 0 ? existing : empty >= 0 ? empty : lines.length;
      if (existing < 0 && empty < 0) setLines((current) => [...current, emptyLine()]);
      if (existing < 0) setTimeout(() => selectProduct(target, String(result.product.id)), 0);
      setHighlightedLine(target); setTimeout(() => setHighlightedLine(null), 1600);
      setBarcode(normalized); setError(null); setErrorCode(null);
    } catch (cause) {
      setError(userErrorMessage(cause, "خواندن بارکد انجام نشد."));
      setErrorCode(diagnosticErrorCode(cause));
    }
  };

  const commit = async () => {
    setBusy(true); setError(null); setErrorCode(null);
    try {
      const invoice = await invoiceService.post({ invoice_type: type, title, counterparty_id: counterpartyId, counterparty, lines: buildPayload() });
      setReviewOpen(false); setSuccessInvoice(invoice);
      setTitle(""); setCounterparty(""); setCounterpartyId(null); setLines([emptyLine()]); setBarcode("");
      await load();
    } catch (cause) {
      setReviewOpen(false);
      setError(userErrorMessage(cause, "ثبت فاکتور انجام نشد."));
      setErrorCode(diagnosticErrorCode(cause));
    } finally { setBusy(false); }
  };
  const runOutput = async (invoice: Invoice, action: "download" | "print" | "share") => {
    setOutputBusy(invoice.id); setError(null); setErrorCode(null);
    try { await invoiceOutput[action](invoice); }
    catch (cause) { setError(userErrorMessage(cause, "ساخت سند انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); }
    finally { setOutputBusy(null); }
  };

  return <Box dir="rtl" className="invoice-page mx-auto w-full">
    <PageGuide section="ابزارها" sectionTo="/tools" title="فاکتورها" description="ثبت خرید و فروش، کنترل موجودی و دریافت سند نهایی." icon={FileTextIcon} helpTopic="invoices" />
    {!canPurchase && !canSale ? <Card><Heading size="4">فاکتورهای تاریخی</Heading><Text as="p" mt="2">ثبت فاکتور در طرح یا نقش فعلی فعال نیست؛ سوابق قبلی برای مشاهده باقی می‌مانند.</Text></Card> : (
      <Form onSubmit={(event) => { event.preventDefault(); setReviewOpen(true); }} isSubmitting={busy} isDirty={dirty} className="invoice-create-layout">
        <main className="invoice-editor">
          <Card size="3" className="invoice-panel invoice-basics">
            <div className="invoice-type-switch" role="group" aria-label="نوع فاکتور">
              <button type="button" data-active={type === "sale"} disabled={!canSale} onClick={() => setInvoiceType("sale")}>فروش</button>
              <button type="button" data-active={type === "purchase"} disabled={!canPurchase} onClick={() => setInvoiceType("purchase")}>خرید</button>
            </div>
            <label><span>عنوان فاکتور</span><input aria-label="عنوان فاکتور" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} placeholder={type === "sale" ? "مثلاً فروش حضوری" : "مثلاً خرید روزانه"}/></label>
            <label><span>طرف‌حساب <small>اختیاری</small></span><input aria-label="طرف حساب" list="invoice-counterparties" value={counterparty} onChange={(event) => chooseCounterparty(event.target.value)} maxLength={200} placeholder="نام را بنویسید یا انتخاب کنید"/><datalist id="invoice-counterparties">{(parties.data ?? []).map((item) => <option key={item.id} value={item.name}>{item.phone ?? (item.kind === "organization" ? "مجموعه" : "فرد")}</option>)}</datalist></label>
          </Card>

          <Card size="3" className="invoice-panel invoice-products-panel">
            <Flex justify="between" align="center" gap="3" wrap="wrap"><Heading size="5"><CubeIcon /> کالاهای فاکتور</Heading><Badge color="violet" size="2">{number(lines.length)} ردیف</Badge></Flex>
            {accessState.canUse("barcode.lookup") && accessState.hasStorePermission("barcodes.lookup") ? <div className="invoice-product-search"><BarcodeCaptureField key={`${accessState.user()?.id}:${accessState.user()?.store_id}`} value={barcode} onValueChange={setBarcode} onScan={(value) => void findBarcode(value)} placeholder="جست‌وجو یا اسکن محصول…"/><Button type="button" variant="soft" onClick={() => void findBarcode()}><MagnifyingGlassIcon /> انتخاب</Button></div> : null}
            <div className="invoice-lines">{lines.map((line, index) => {
              const product = products.find((item) => item.id === Number(line.productId));
              const lineTotal = (Number(line.quantity) || 0) * (Number(line.price) || 0);
              return <article key={index} className="invoice-line" data-highlighted={highlightedLine === index} data-invoice-line={index} tabIndex={-1}>
                <div className="invoice-line-index">{number(index + 1)}</div>
                <label className="invoice-line-product"><span>محصول</span><select aria-label={`محصول ردیف ${index + 1}`} value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} required><option value="">انتخاب محصول</option>{products.map((item) => <option key={item.id} value={item.id}>{item.custom_label || item.catalog_product?.name || `#${item.id}`} — موجودی {number(item.quantity)}</option>)}</select></label>
                <label className="invoice-line-quantity"><span>تعداد</span><div className="invoice-stepper"><button type="button" aria-label={`یک واحد بیشتر برای ردیف ${index + 1}`} onClick={() => changeQuantity(index, 1)}><PlusIcon /></button><input aria-label={`تعداد ردیف ${index + 1}`} type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })}/><button type="button" aria-label={`یک واحد کمتر برای ردیف ${index + 1}`} onClick={() => changeQuantity(index, -1)}><MinusIcon /></button></div></label>
                <label><span>واحد</span><select aria-label={`واحد ردیف ${index + 1}`} value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value as DraftLine["unit"] })}><option value="unit">عدد</option>{product?.catalog_product?.is_packaged ? <option value="pack">بسته</option> : null}</select></label>
                <label><span>قیمت واحد</span><input aria-label={`قیمت ردیف ${index + 1}`} type="number" min="0" step="1" value={line.price} onChange={(event) => updateLine(index, { price: event.target.value })} required placeholder="تومان"/></label>
                <div className="invoice-line-total"><span>جمع ردیف</span><strong>{toman(lineTotal)}</strong></div>
                {lines.length > 1 ? <IconButton type="button" color="red" variant="soft" aria-label={`حذف ردیف ${index + 1}`} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}><TrashIcon /></IconButton> : null}
              </article>;
            })}</div>
            <button type="button" className="invoice-add-line" onClick={() => setLines((current) => [...current, emptyLine()])}><PlusIcon /> افزودن ردیف</button>
          </Card>
        </main>

        <aside className="invoice-summary"><Card size="3" className="invoice-summary-card">
          <Heading size="5">خلاصه فاکتور</Heading>
          <dl><div><dt>ردیف‌ها</dt><dd>{number(lines.length)}</dd></div><div><dt>تعداد اقلام</dt><dd>{number(totalItems)}</dd></div><div className="invoice-summary-total"><dt>جمع کل</dt><dd>{toman(total)}</dd></div></dl>
          {completedLines !== lines.length ? <div className="invoice-validation-note">{number(lines.length - completedLines)} ردیف نیاز به تکمیل دارد</div> : null}
          <Button type="submit" className="invoice-submit" disabled={!title.trim() || completedLines !== lines.length}><CheckIcon /> بررسی و ثبت قطعی</Button>
          <Text as="p" size="1" color="gray">پس از تأیید، فاکتور و ردیف‌ها قابل ویرایش نیستند.</Text>
        </Card></aside>
        {error ? <Box className="invoice-form-error" role="alert"><Text as="p" color="red">{error}</Text>{errorCode ? <details className="sync-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{errorCode}</code></details> : null}</Box> : null}
      </Form>
    )}

    <InvoiceHistory invoices={invoices} canOutput={canPurchase || canSale} outputBusy={outputBusy} onOutput={runOutput} onReload={load} onError={(cause) => { setError(userErrorMessage(cause, "لغو فاکتور انجام نشد.")); setErrorCode(diagnosticErrorCode(cause)); }}/>
    <ConfirmDialog open={reviewOpen} onOpenChange={setReviewOpen} title="تأیید ثبت فاکتور" description="پس از ثبت، فاکتور و ردیف‌های آن قابل ویرایش نیستند." confirmLabel="تأیید و ثبت" variant="warning" loading={busy} disabled={!title.trim() || completedLines !== lines.length} details={<div className="invoice-confirm-summary"><span>نوع: <b>{type === "sale" ? "فروش" : "خرید"}</b></span><span>ردیف‌ها: <b>{number(lines.length)}</b></span><span>جمع: <b>{toman(total)}</b></span></div>} onConfirm={() => void commit()}/>
    <Dialog.Root open={successInvoice !== null} onOpenChange={(open) => { if (!open) setSuccessInvoice(null); }}><Dialog.Content dir="rtl" maxWidth="520px" className="invoice-success-dialog"><div className="invoice-success-icon"><CheckIcon /></div><Dialog.Title>فاکتور با موفقیت ثبت شد</Dialog.Title><Dialog.Description>سند آماده دریافت، چاپ یا اشتراک‌گذاری است.</Dialog.Description>{successInvoice ? <><div className="invoice-success-summary"><span>{successInvoice.title}</span><b>{toman(successInvoice.total_amount)}</b></div><Flex gap="2" mt="4" wrap="wrap" justify="center"><Button variant="soft" onClick={() => void runOutput(successInvoice, "download")} loading={outputBusy === successInvoice.id}><FileTextIcon /> PDF</Button><Button variant="soft" onClick={() => void runOutput(successInvoice, "print")}><ReaderIcon /> چاپ</Button><Button variant="soft" onClick={() => void runOutput(successInvoice, "share")}><Share2Icon /> اشتراک</Button></Flex></> : null}<Dialog.Close><Button mt="4" variant="soft" color="gray" className="w-full">بستن</Button></Dialog.Close></Dialog.Content></Dialog.Root>
  </Box>;
}

function InvoiceHistory({ invoices, canOutput, outputBusy, onOutput, onReload, onError }: {
  invoices: Invoice[];
  canOutput: boolean;
  outputBusy: number | null;
  onOutput: (invoice: Invoice, action: "download" | "print" | "share") => Promise<void>;
  onReload: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  return <section className="invoice-history">
    <Heading as="h2" size="5">تاریخچه فاکتورها</Heading>
    <div className="invoice-history-grid">{invoices.map((invoice) => <Card key={invoice.id} className="invoice-history-card">
      <Flex justify="between" gap="2"><Box><Text weight="bold">{invoice.title}</Text><Text as="div" size="2" color="gray">{invoice.invoice_type === "purchase" ? "خرید" : "فروش"} · {formatJalaliDateTime(invoice.posted_at)}</Text></Box><Badge color={invoice.status === "accepted" ? "green" : invoice.status === "cancelled" ? "gray" : invoice.status === "rejected" || invoice.status === "conflict" ? "red" : "orange"}>{{ accepted: "تأییدشده", cancelled: "باطل‌شده", pending: "ذخیره‌شده روی این دستگاه", cancel_pending: "لغو در انتظار تأیید", rejected: "پذیرفته‌نشده", conflict: "نیازمند بررسی" }[invoice.status]}</Badge></Flex>
      {invoice.counterparty ? <Text as="p" mt="2">طرف‌حساب: {invoice.counterparty}</Text> : null}
      <Text as="div" weight="bold" mt="2">جمع: {toman(invoice.total_amount)}</Text>
      <Flex mt="3" gap="2" wrap="wrap">
        {canOutput && canUseInvoiceOutput(invoice) ? <><Button type="button" variant="soft" loading={outputBusy === invoice.id} onClick={() => void onOutput(invoice, "download")}>دریافت PDF</Button><Button type="button" variant="soft" onClick={() => void onOutput(invoice, "print")}>چاپ</Button><Button type="button" variant="soft" onClick={() => void onOutput(invoice, "share")}>اشتراک‌گذاری</Button></> : null}
        {accessState.hasStorePermission("invoices.cancel") && accessState.canUse(`invoices.${invoice.invoice_type}`) && !["cancelled", "cancel_pending", "rejected", "conflict"].includes(invoice.status) ? <Button color="red" variant="soft" onClick={() => void invoiceService.cancel(invoice.id).then(onReload).catch(onError)}>لغو کامل فاکتور</Button> : null}
      </Flex>
    </Card>)}</div>
  </section>;
}
