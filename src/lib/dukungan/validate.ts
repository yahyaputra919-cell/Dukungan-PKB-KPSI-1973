/** Validasi format NIK dan isian. Bukan pengecekan ke Dukcapil. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function calendarOk(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** 16 digit, bukan angka yang sama semua, tanggal lahir di posisi NIK masuk akal. */
export function isValidNik(raw: string): boolean {
  const nik = digitsOnly(raw);
  if (!/^\d{16}$/.test(nik)) return false;
  if (/^(\d)\1{15}$/.test(nik)) return false;
  let day = Number(nik.slice(6, 8));
  const month = Number(nik.slice(8, 10));
  const year = Number(nik.slice(10, 12));
  if (day > 40) day -= 40;
  return calendarOk(day, month, 1900 + year) || calendarOk(day, month, 2000 + year);
}

export function maskNik(nik: string): string {
  const digits = digitsOnly(nik);
  return `${digits.slice(0, 4)}${"*".repeat(12)}`;
}

export function cleanPersonName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 80) return null;
  if (!/^[\p{L}\s.'’-]+$/u.test(name)) return null;
  return name;
}

export function cleanLabel(raw: string, min = 2, max = 80): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < min || name.length > max) return null;
  if (/[\u0000-\u001f]/.test(name)) return null;
  return name;
}

export function cleanSignature(raw: string): string | null {
  const prefix = "data:image/png;base64,";
  if (!raw.startsWith(prefix)) return null;
  if (raw.length < 200 || raw.length > 400_000) return null;
  const body = raw.slice(prefix.length);
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) return null;
  return raw;
}

export function parseLines(raw: string, max = 200): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = cleanLabel(line);
    if (!name) continue;
    const key = name.toLocaleLowerCase("id");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}
