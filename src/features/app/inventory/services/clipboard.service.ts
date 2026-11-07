export async function copyPlainText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission and browser-policy failures can still allow the
      // synchronous fallback while this call is inside the user gesture.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand?.("copy")) throw new Error("COPY_UNAVAILABLE");
  } finally {
    textarea.remove();
  }
}

export function productClipboardText(name: string, salePrice: number | null | undefined) {
  return `${name}\n${salePrice == null ? "قیمت فروش ثبت نشده" : `${salePrice.toLocaleString("fa-IR")} تومان`}`;
}
