import type { BarcodeSymbology } from "../types";

const CODE128_ASCII = /^[\x20-\x7E]+$/;
const INTERNAL_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TRANSPORT_PREFIX = /^[\t\r\n]+/;
const TRANSPORT_SUFFIX = /[\t\r\n]+$/;

export type BarcodeValidation = { valid: true } | { valid: false; error: string };

export function sanitizeScannedValue(value: string) {
  return value.replace(TRANSPORT_PREFIX, "").replace(TRANSPORT_SUFFIX, "");
}

function numericChecksum(value: string) {
  const digits = [...value].map(Number);
  const check = digits.pop();
  if (check == null) return false;
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += digits[index] * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

function expandUpce(value: string) {
  if (!/^\d{8}$/.test(value)) return null;
  const numberSystem = value[0];
  if (numberSystem !== "0" && numberSystem !== "1") return null;
  const body = value.slice(1, 7);
  const check = value[7];
  const last = body[5];
  if ("012".includes(last)) return `${numberSystem}${body.slice(0, 2)}${last}0000${body.slice(2, 5)}${check}`;
  if (last === "3") return `${numberSystem}${body.slice(0, 3)}00000${body.slice(3, 5)}${check}`;
  if (last === "4") return `${numberSystem}${body.slice(0, 4)}00000${body[4]}${check}`;
  return `${numberSystem}${body.slice(0, 5)}0000${last}${check}`;
}

export function validateBarcode(value: string, symbology: BarcodeSymbology): BarcodeValidation {
  if (!value) return { valid: false, error: "کد خالی است" };
  if (value.length > 64) return { valid: false, error: "کد نباید بیش از ۶۴ نویسه باشد" };

  if (symbology === "code128" || symbology === "unknown") {
    return CODE128_ASCII.test(value)
      ? { valid: true }
      : { valid: false, error: "Code 128 فقط نویسه‌های ASCII قابل چاپ را می‌پذیرد" };
  }

  const lengths: Record<Exclude<BarcodeSymbology, "code128" | "unknown">, number> = {
    ean13: 13,
    ean8: 8,
    upca: 12,
    upce: 8,
  };
  if (!/^\d+$/.test(value) || value.length !== lengths[symbology]) {
    return { valid: false, error: "طول یا نویسه‌های بارکد با قالب انتخاب‌شده سازگار نیست" };
  }
  const checksumValue = symbology === "upce" ? expandUpce(value) : value;
  return checksumValue && numericChecksum(checksumValue)
    ? { valid: true }
    : { valid: false, error: "رقم کنترل بارکد معتبر نیست" };
}

export function inferSymbology(value: string): BarcodeSymbology {
  if (/^\d{13}$/.test(value) && validateBarcode(value, "ean13").valid) return "ean13";
  if (/^\d{12}$/.test(value) && validateBarcode(value, "upca").valid) return "upca";
  if (/^\d{8}$/.test(value) && validateBarcode(value, "ean8").valid) return "ean8";
  return "code128";
}

export function barcodeLookupCandidates(value: string, symbology = inferSymbology(value)): string[] {
  const candidates = [value];
  if (!validateBarcode(value, symbology).valid) return candidates;
  if (symbology === "upca") candidates.push(`0${value}`);
  if (symbology === "ean13" && value.startsWith("0") && validateBarcode(value.slice(1), "upca").valid) {
    candidates.push(value.slice(1));
  }
  return candidates;
}

function encodeBase32(bytes: Uint8Array) {
  let bits = 0;
  let buffer = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += INTERNAL_ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) output += INTERNAL_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

export async function generateInternalBarcode(options: {
  exists(value: string): Promise<boolean>;
  randomBytes?: () => Uint8Array;
  attempts?: number;
}) {
  const randomBytes = options.randomBytes ?? (() => crypto.getRandomValues(new Uint8Array(10)));
  for (let attempt = 0; attempt < (options.attempts ?? 8); attempt += 1) {
    // 60 random bits keep the label compact enough for common 50 mm media
    // while retaining ample collision resistance for store-local identifiers.
    const value = `TZ-${encodeBase32(randomBytes()).slice(0, 12)}`;
    if (!(await options.exists(value))) return value;
  }
  throw new Error("ساخت بارکد یکتا ممکن نشد؛ دوباره تلاش کنید");
}
