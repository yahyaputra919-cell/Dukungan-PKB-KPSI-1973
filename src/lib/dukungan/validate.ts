/** Validasi format NIK karyawan dan isian. NIK di sini Nomor Induk Karyawan (10 angka), bukan NIK KTP. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 10 digit, bukan angka yang sama semua. Tidak ada tanggal lahir di dalamnya. */
export function isValidNik(raw: string): boolean {
  const nik = digitsOnly(raw);
  if (!/^\d{10}$/.test(nik)) return false;
  if (/^(\d)\1{9}$/.test(nik)) return false;
  return true;
}

export function maskNik(nik: string): string {
  const digits = digitsOnly(nik);
  return `${digits.slice(0, 4)}${"*".repeat(Math.max(0, digits.length - 4))}`;
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
