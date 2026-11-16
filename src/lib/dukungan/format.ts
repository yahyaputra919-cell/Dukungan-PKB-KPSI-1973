export function formatWib(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")} WIB`;
}

export function asDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export function formatPct(part: number, whole: number): string {
  if (whole <= 0) return "0";
  const value = (part / whole) * 100;
  if (value > 0 && value < 10) return value.toFixed(1).replace(".", ",");
  return String(Math.round(value));
}

export function targetCount(total: number | null, percent: number): number | null {
  if (!total || total < 1) return null;
  return Math.ceil((total * percent) / 100);
}
