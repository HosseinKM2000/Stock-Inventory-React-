import type { InvoiceDocument } from "./invoice-document";

const W = 1240;
const H = 1754;
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function wrap(context: CanvasRenderingContext2D, value: string, width: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && context.measureText(next).width > width) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function header(context: CanvasRenderingContext2D, document: InvoiceDocument, page: number) {
  context.fillStyle = "#152b3b";
  context.fillRect(0, 0, W, 18);
  context.fillStyle = "#10212d";
  context.textAlign = "right";
  context.direction = "rtl";
  context.font = "700 44px Vazirmatn";
  context.fillText(document.typeLabel, 1140, 92);
  context.font = "500 25px Vazirmatn";
  context.fillStyle = "#405261";
  context.fillText(document.title, 1140, 140);
  context.textAlign = "left";
  context.direction = "ltr";
  context.fillText(`صفحه ${number(page)}`, 100, 92);
  context.direction = "rtl";
  context.fillText(`تاریخ: ${document.postedAt}`, 100, 135);
  context.textAlign = "right";
  context.fillText(`شناسه: ${document.reference}`, 1140, 184);
  if (document.counterparty) context.fillText(`طرف حساب: ${document.counterparty}`, 1140, 224);
  if (document.localOnly) { context.fillStyle = "#9a5a00"; context.fillText("ذخیره‌شده روی این دستگاه", 1140, 264); }
}

function tableHeader(context: CanvasRenderingContext2D, y: number) {
  context.fillStyle = "#e9eff3"; context.fillRect(80, y, 1080, 58);
  context.fillStyle = "#213442"; context.font = "700 23px Vazirmatn"; context.textAlign = "right"; context.direction = "rtl";
  context.fillText("شرح کالا", 1120, y + 38); context.fillText("تعداد", 590, y + 38); context.fillText("فی", 400, y + 38); context.fillText("مبلغ", 190, y + 38);
  return y + 58;
}

function watermark(context: CanvasRenderingContext2D, document: InvoiceDocument) {
  if (!document.cancelled) return;
  context.save(); context.translate(W / 2, H / 2); context.rotate(-Math.PI / 5); context.globalAlpha = .13;
  context.fillStyle = "#b42318"; context.font = "800 150px Vazirmatn"; context.textAlign = "center"; context.direction = "rtl";
  context.fillText("باطل‌شده", 0, 0); context.restore();
}

export async function renderInvoicePages(document: InvoiceDocument): Promise<HTMLCanvasElement[]> {
  await documentFont();
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement; let context!: CanvasRenderingContext2D; let y = 0;
  const nextPage = () => {
    canvas = window.document.createElement("canvas"); canvas.width = W; canvas.height = H;
    context = canvas.getContext("2d")!; context.fillStyle = "white"; context.fillRect(0, 0, W, H);
    pages.push(canvas); header(context, document, pages.length); watermark(context, document); y = tableHeader(context, 310);
  };
  nextPage();
  for (const line of document.lines) {
    context.font = "500 24px Vazirmatn";
    const names = wrap(context, line.product, 470); const rowHeight = Math.max(62, names.length * 34 + 24);
    if (y + rowHeight > H - 190) nextPage();
    context.strokeStyle = "#d8e0e5"; context.strokeRect(80, y, 1080, rowHeight);
    context.fillStyle = "#172b38"; context.textAlign = "right"; context.direction = "rtl";
    names.forEach((name, index) => context.fillText(name, 1120, y + 38 + index * 34));
    context.fillText(`${number(line.quantity)} ${line.unit}`, 590, y + 38);
    context.fillText(number(line.unitPrice), 400, y + 38); context.fillText(number(line.total), 190, y + 38); y += rowHeight;
  }
  if (y + 105 > H - 80) nextPage();
  context.fillStyle = "#152b3b"; context.fillRect(650, y + 28, 510, 68); context.fillStyle = "white"; context.font = "700 29px Vazirmatn";
  context.textAlign = "right"; context.fillText(`جمع کل: ${number(document.total)} تومان`, 1120, y + 73);
  return pages;
}

async function documentFont() {
  // The app font is normally already cached. A rejected font fetch while the
  // device is offline must not prevent creation of an otherwise local PDF.
  await window.document.fonts?.load("24px Vazirmatn").catch(() => undefined);
}

function bytes(value: string) { return new TextEncoder().encode(value); }
function concat(parts: Uint8Array[]) { const size = parts.reduce((sum, part) => sum + part.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }

export async function createInvoicePdf(document: InvoiceDocument): Promise<File> {
  const pages = await renderInvoicePages(document);
  const objects: Uint8Array[] = [new Uint8Array(), bytes("<< /Type /Catalog /Pages 2 0 R >>")];
  const kids: string[] = [];
  pages.forEach((canvas, index) => {
    const imageId = 3 + index * 3; const contentId = imageId + 1; const pageId = imageId + 2; kids.push(`${pageId} 0 R`);
    const data = atob(canvas.toDataURL("image/jpeg", .9).split(",")[1]); const image = Uint8Array.from(data, (char) => char.charCodeAt(0));
    objects[imageId] = concat([bytes(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, bytes("\nendstream")]);
    const command = bytes(`q 595 0 0 842 0 0 cm /Im${index} Do Q`);
    objects[contentId] = concat([bytes(`<< /Length ${command.length} >>\nstream\n`), command, bytes("\nendstream")]);
    objects[pageId] = bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objects[2] = bytes(`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`);
  const output: Uint8Array[] = [bytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")]; const offsets = [0]; let offset = output[0].length;
  for (let id = 1; id < objects.length; id += 1) { offsets[id] = offset; const part = concat([bytes(`${id} 0 obj\n`), objects[id], bytes("\nendobj\n")]); output.push(part); offset += part.length; }
  const xref = offset; output.push(bytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return new File([concat(output) as BlobPart], `invoice-${document.id}.pdf`, { type: "application/pdf" });
}
