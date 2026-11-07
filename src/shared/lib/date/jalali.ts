const latinDigits = "0123456789";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const dateOnlyPattern = /^(\d{4})\/(\d{2})\/(\d{2})$/;

export function normalizeDateDigits(value: string) {
  return [...value].map((character) => {
    const persian = persianDigits.indexOf(character);
    if (persian >= 0) return latinDigits[persian];
    const arabic = arabicDigits.indexOf(character);
    return arabic >= 0 ? latinDigits[arabic] : character;
  }).join("");
}

function parts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const values = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function faDigits(value: string) {
  return value.replace(/\d/g, (digit) => persianDigits[Number(digit)]);
}

export function formatJalaliDate(value: Date | string | number, timeZone = "Asia/Tehran") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const result = parts(date, timeZone);
  return faDigits(`${result.year.toString().padStart(4, "0")}/${result.month.toString().padStart(2, "0")}/${result.day.toString().padStart(2, "0")}`);
}

export function formatJalaliDateTime(value: Date | string | number, timeZone = "Asia/Tehran") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("fa-IR-u-nu-latn", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${formatJalaliDate(date, timeZone)} ${faDigits(time)}`;
}

export function parseJalaliDate(value: string): string | null {
  const normalized = normalizeDateDigits(value.trim());
  const match = dateOnlyPattern.exec(normalized);
  if (!match) return null;
  const target = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (target.year < 1200 || target.year > 1700 || target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31) return null;
  const start = Date.UTC(target.year + 621, 0, 1, 12);
  for (let offset = 0; offset < 500; offset += 1) {
    const candidate = new Date(start + offset * 86_400_000);
    const candidateParts = parts(candidate, "UTC");
    if (candidateParts.year === target.year && candidateParts.month === target.month && candidateParts.day === target.day) return candidate.toISOString().slice(0, 10);
  }
  return null;
}

export function formatJalaliDateOnly(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "—";
  return formatJalaliDate(`${isoDate}T12:00:00.000Z`, "UTC");
}
