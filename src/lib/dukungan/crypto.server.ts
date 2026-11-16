import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export type KeyMode = "explicit" | "host" | "preview";

const PREVIEW_SECRET = "preview-puk-kspsi-1973-bukan-kunci-produksi";
const SALT = "puk-kspsi-1973-nik-v1";

type Material = { secret: string; source: KeyMode };

function material(): Material {
  const explicit = process.env.NIK_ENCRYPTION_KEY?.trim();
  if (explicit && explicit.length >= 16) return { secret: explicit, source: "explicit" };
  const host = process.env.BETTER_AUTH_SECRET?.trim();
  if (host && host.length >= 24) return { secret: host, source: "host" };
  return { secret: PREVIEW_SECRET, source: "preview" };
}

const cache: { key?: Buffer; source?: KeyMode; fingerprint?: string } = {};

function key(): Buffer {
  if (!cache.key) {
    const current = material();
    cache.source = current.source;
    cache.key = scryptSync(current.secret, SALT, 32);
    cache.fingerprint = createHash("sha256").update(cache.key).digest("hex").slice(0, 10);
  }
  return cache.key;
}

export function keyStatus(): { source: KeyMode; fingerprint: string } {
  key();
  return { source: cache.source ?? "preview", fingerprint: cache.fingerprint ?? "" };
}

export function encryptNik(nik: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(nik, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptNik(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function nikHmac(nik: string): string {
  return createHmac("sha256", key()).update(`nik:${nik}`).digest("hex");
}

export function hashIp(ip: string): string {
  return createHmac("sha256", key()).update(`ip:${ip}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function issueChallenge(): { a: number; b: number; token: string } {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 8);
  const issued = Date.now();
  const exp = issued + 30 * 60 * 1000;
  const nonce = randomBytes(8).toString("base64url");
  const payload = `v1|${a}|${b}|${issued}|${exp}|${nonce}`;
  return { a, b, token: `${payload}.${sign(payload)}` };
}

export function verifyChallenge(token: string, answer: string): "ok" | "expired" | "bad" {
  const split = token.split(".");
  if (split.length !== 2) return "bad";
  const [payload, mac] = split;
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return "bad";
  const parts = payload.split("|");
  if (parts.length !== 6 || parts[0] !== "v1") return "bad";
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  const issued = Number(parts[3]);
  const exp = Number(parts[4]);
  const now = Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(issued) || !Number.isFinite(exp)) {
    return "bad";
  }
  if (now > exp) return "expired";
  if (now < issued + 2500) return "bad";
  if (String(a + b) !== answer.trim()) return "bad";
  return "ok";
}

export function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const ACTIVATION_CODE = "DUKUNG-PKB-1973";

export function receiptCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
