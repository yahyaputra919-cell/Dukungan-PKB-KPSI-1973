import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { asDate, formatWib, targetCount } from "@/lib/dukungan/format";
import type {
  Fail,
  OfficialRow,
  Progress,
  PublicCatalog,
  SettingsInput,
  StoreStat,
  SubmissionRow,
  SubmissionStatus,
  SubmitInput,
  SubmitOk,
} from "@/lib/dukungan/types";
import {
  cleanLabel,
  cleanPersonName,
  cleanSignature,
  digitsOnly,
  isValidNik,
  maskNik,
  parseLines,
} from "@/lib/dukungan/validate";

/**
 * Publik hanya boleh menambah dukungan dan membaca angka agregat.
 * Daftar nama, NIK, dan tanda tangan hanya untuk pengurus yang sudah masuk.
 */

type Sql = Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>;

async function gate(): Promise<void> {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  assertSameSiteRequest();
}

async function db(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function fail(message: string, code?: string): Fail {
  return { ok: false, message, code };
}

type SettingsRow = {
  total_employees: number | null;
  target_percent: number;
  statement_text: string;
  consent_text: string;
  contact_name: string;
  contact_detail: string;
  retention_note: string;
};

async function loadSettings(sql: Sql): Promise<SettingsRow> {
  const rows = await sql<SettingsRow>`
    select total_employees, target_percent, statement_text, consent_text,
           contact_name, contact_detail, retention_note
    from settings where id = 1
  `;
  const row = rows[0];
  if (!row) throw new Error("Pengaturan belum siap. Muat ulang halaman.");
  return row;
}

async function loadProgress(sql: Sql, settings: SettingsRow): Promise<Progress> {
  const counts = await sql<{ submitted: number; verified: number }>`
    select count(*)::int as submitted,
           count(*) filter (where status = 'verified')::int as verified
    from submissions
  `;
  const submitted = Number(counts[0]?.submitted ?? 0);
  const verified = Number(counts[0]?.verified ?? 0);
  const total = settings.total_employees ? Number(settings.total_employees) : null;
  const percent = Number(settings.target_percent) || 50;
  return {
    submitted,
    verified,
    totalEmployees: total,
    targetPercent: percent,
    targetCount: targetCount(total, percent),
  };
}

async function clientIpHash(): Promise<string> {
  const { hashIp } = await import("./crypto.server");
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest()?.headers;
    const ip =
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers?.get("x-real-ip") ||
      "unknown";
    return hashIp(ip);
  } catch {
    return hashIp("unknown");
  }
}

async function actor(userId: string): Promise<{ email: string; name: string } | null> {
  const sql = await db();
  const users = await sql<{ email: string; name: string }>`
    select email, name from "user" where id = ${userId}
  `;
  const user = users[0];
  if (!user?.email) return null;
  return { email: user.email.toLowerCase(), name: user.name };
}

async function adminOf(userId: string): Promise<{ email: string; name: string } | null> {
  const user = await actor(userId);
  if (!user) return null;
  const sql = await db();
  const rows = await sql<{ email: string }>`
    select email from admins where lower(email) = ${user.email}
  `;
  return rows[0] ? user : null;
}

async function writeAudit(userId: string, email: string, action: string, detail: string) {
  const sql = await db();
  await sql`
    insert into audit_log (actor_user_id, actor_email, action, detail)
    values (${userId}, ${email}, ${action}, ${detail.slice(0, 300)})
  `;
}

function mapRow(row: {
  id: string;
  receipt_code: string;
  full_name: string;
  nik_mask: string;
  store_name: string;
  store_code: string;
  position_name: string;
  consent_member: boolean;
  status: string;
  created_at: unknown;
}): SubmissionRow {
  const status: SubmissionStatus = row.status === "verified" ? "verified" : "pending";
  return {
    id: row.id,
    receipt: row.receipt_code,
    fullName: row.full_name,
    nikMask: row.nik_mask,
    storeName: row.store_name,
    storeCode: row.store_code ?? "",
    positionName: row.position_name,
    consentMember: Boolean(row.consent_member),
    status,
    at: formatWib(asDate(row.created_at)),
  };
}

export const getPublicCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<PublicCatalog> => {
  await gate();
  const sql = await db();
  const settings = await loadSettings(sql);
  const stores = await sql<{ name: string }>`
    select name from stores where active = true order by name asc
  `;
  const positions = await sql<{ name: string }>`
    select name from positions where active = true order by sort_order asc, name asc
  `;
  const { issueChallenge } = await import("./crypto.server");
  return {
    statementText: settings.statement_text,
    consentText: settings.consent_text,
    contactName: settings.contact_name,
    contactDetail: settings.contact_detail,
    retentionNote: settings.retention_note,
    stores: stores.map((row) => row.name),
    positions: positions.map((row) => row.name),
    progress: await loadProgress(sql, settings),
    challenge: issueChallenge(),
  };
});

export const submitSupport = createServerFn({ method: "POST" })
  .validator((input: SubmitInput) => input)
  .handler(async ({ data }): Promise<SubmitOk | Fail> => {
    await gate();
    if (typeof data?.hpField === "string" && data.hpField.trim() !== "") {
      return fail("Formulir tidak dapat diproses.", "bot");
    }
    const fullName = cleanPersonName(String(data?.fullName ?? ""));
    if (!fullName) return fail("Nama lengkap belum benar. Gunakan 3–80 huruf.");
    const nik = digitsOnly(String(data?.nik ?? ""));
    if (!isValidNik(nik)) return fail("NIK harus 10 angka (Nomor Induk Karyawan).");
    const storeName = cleanLabel(String(data?.storeName ?? ""));
    if (!storeName) return fail("Isi nama toko.");
    const storeCode = cleanLabel(String(data?.storeCode ?? ""), 1, 20);
    if (!storeCode) return fail("Isi kode toko.");
    const positionName = cleanLabel(String(data?.positionName ?? ""));
    if (!positionName) return fail("Pilih jabatan.");
    if (data?.consentRepresent !== true) {
      return fail("Centang persetujuan dukungan sebelum mengirim.");
    }
    const signature = cleanSignature(String(data?.signaturePng ?? ""));
    if (!signature) return fail("Tanda tangan belum tersimpan. Gambar di kotak lalu coba lagi.");

    const { nikHmac, encryptNik, verifyChallenge, receiptCode } = await import("./crypto.server");
    const challenge = verifyChallenge(
      String(data?.challengeToken ?? ""),
      String(data?.challengeAnswer ?? ""),
    );
    if (challenge === "expired") {
      return fail("Pertanyaan keamanan kedaluwarsa. Muat ulang pertanyaan, lalu kirim lagi.", "challenge");
    }
    if (challenge !== "ok") {
      return fail("Jawaban keamanan belum tepat, atau formulir diisi terlalu cepat.", "challenge");
    }

    const sql = await db();
    const positions = await sql<{ name: string }>`
      select name from positions where active = true and lower(name) = lower(${positionName})
    `;
    const position = positions[0]?.name;
    if (!position) return fail("Jabatan tidak ada di daftar. Muat ulang halaman.");

    const ip = await clientIpHash();
    await sql`delete from rate_hits where created_at < now() - interval '2 hours'`;
    const hits = await sql<{ n: number }>`
      select count(*)::int as n from rate_hits
      where ip_hash = ${ip} and created_at > now() - interval '1 hour'
    `;
    if (Number(hits[0]?.n ?? 0) >= 40) {
      return fail("Terlalu banyak percobaan dari jaringan ini. Coba lagi sekitar satu jam lagi.", "rate");
    }
    await sql`insert into rate_hits (ip_hash) values (${ip})`;

    const hmac = nikHmac(nik);
    const existing = await sql<{ id: string }>`select id from submissions where nik_hmac = ${hmac}`;
    if (existing[0]) {
      return fail(
        "NIK ini sudah tercatat. Satu karyawan hanya satu pernyataan. Jika bukan Anda yang mengisi, hubungi pengurus.",
        "duplicate",
      );
    }

    const known = await sql<{ name: string }>`
      select name from stores where lower(name) = lower(${storeName})
    `;
    const store = known[0]?.name ?? storeName;
    if (known[0]) {
      await sql`update stores set active = true where lower(name) = lower(${storeName})`;
    } else {
      await sql`insert into stores (name) values (${store}) on conflict do nothing`;
    }

    const settings = await loadSettings(sql);
    const id = crypto.randomUUID();
    const receipt = receiptCode();
    try {
      await sql`
        insert into submissions (
          id, receipt_code, full_name, nik_hmac, nik_cipher, nik_mask,
          store_name, store_code, position_name, signature_png, consent_represent,
          consent_text, consent_member
        ) values (
          ${id}, ${receipt}, ${fullName}, ${hmac}, ${encryptNik(nik)}, ${maskNik(nik)},
          ${store}, ${storeCode}, ${position}, ${signature}, ${true},
          ${settings.consent_text}, ${data.consentMember === true}
        )
      `;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "23505") {
        return fail(
          "NIK ini sudah tercatat. Satu karyawan hanya satu pernyataan. Jika bukan Anda yang mengisi, hubungi pengurus.",
          "duplicate",
        );
      }
      throw error;
    }
    return {
      ok: true,
      receipt,
      fullName,
      storeName: store,
      storeCode,
      positionName: position,
      nikMask: maskNik(nik),
      at: formatWib(new Date()),
      consentMember: data.consentMember === true,
    };
  });

export type AdminHome =
  | {
      ok: true;
      isAdmin: false;
      email: string | null;
      name: string | null;
      adminCount: number;
    }
  | {
      ok: true;
      isAdmin: true;
      email: string;
      name: string;
      adminCount: number;
      keyMode: "explicit" | "host" | "preview";
      keyFingerprint: string;
      progress: Progress;
      byStore: StoreStat[];
      stores: { name: string; active: boolean }[];
      positions: { name: string; active: boolean }[];
      admins: { email: string; displayName: string | null }[];
      settings: SettingsInput;
    };

export const getAdminHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminHome> => {
    await gate();
    const sql = await db();
    const user = await actor(context.userId);
    const countRows = await sql<{ n: number }>`select count(*)::int as n from admins`;
    const adminCount = Number(countRows[0]?.n ?? 0);
    if (!user) {
      return { ok: true, isAdmin: false, email: null, name: null, adminCount };
    }
    const admin = await adminOf(context.userId);
    if (!admin) {
      return { ok: true, isAdmin: false, email: user.email, name: user.name, adminCount };
    }
    const settings = await loadSettings(sql);
    const byStore = await sql<{ store_name: string; total: number; verified: number }>`
      select store_name,
             count(*)::int as total,
             count(*) filter (where status = 'verified')::int as verified
      from submissions
      group by store_name
      order by total desc, store_name asc
    `;
    const stores = await sql<{ name: string; active: boolean }>`
      select name, active from stores order by name asc
    `;
    const positions = await sql<{ name: string; active: boolean }>`
      select name, active from positions order by sort_order asc, name asc
    `;
    const admins = await sql<{ email: string; display_name: string | null }>`
      select email, display_name from admins order by email asc
    `;
    const { keyStatus } = await import("./crypto.server");
    const key = keyStatus();
    return {
      ok: true,
      isAdmin: true,
      email: admin.email,
      name: admin.name,
      adminCount,
      keyMode: key.source,
      keyFingerprint: key.fingerprint,
      progress: await loadProgress(sql, settings),
      byStore: byStore.map((row) => ({
        storeName: row.store_name,
        total: Number(row.total),
        verified: Number(row.verified),
      })),
      stores,
      positions,
      admins: admins.map((row) => ({ email: row.email, displayName: row.display_name })),
      settings: {
        totalEmployees: settings.total_employees ? Number(settings.total_employees) : null,
        targetPercent: Number(settings.target_percent),
        statementText: settings.statement_text,
        consentText: settings.consent_text,
        contactName: settings.contact_name,
        contactDetail: settings.contact_detail,
        retentionNote: settings.retention_note,
      },
    };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => code)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const sql = await db();
    const countRows = await sql<{ n: number }>`select count(*)::int as n from admins`;
    if (Number(countRows[0]?.n ?? 0) > 0) {
      return fail("Pengurus sudah diaktifkan. Minta yang sudah masuk untuk menambah email Anda.");
    }
    const user = await actor(context.userId);
    if (!user) return fail("Akun ini tidak punya email. Masuk dengan Google atau X.");
    const { ACTIVATION_CODE, safeEqualText } = await import("./crypto.server");
    if (!safeEqualText(String(data ?? "").trim(), ACTIVATION_CODE)) {
      return fail("Kode aktivasi tidak sesuai.");
    }
    await sql`
      insert into admins (email, user_id, display_name)
      values (${user.email}, ${context.userId}, ${user.name})
    `;
    await writeAudit(context.userId, user.email, "aktivasi", "Pengurus pertama diaktifkan");
    return { ok: true };
  });

export type ListResult =
  | { ok: true; rows: SubmissionRow[]; total: number }
  | Fail;

export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { q: string; store: string; position: string; offset: number }) => input)
  .handler(async ({ context, data }): Promise<ListResult> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const q = String(data?.q ?? "")
      .trim()
      .replace(/[%_\\]/g, "")
      .slice(0, 60);
    const pattern = q ? `%${q}%` : "";
    const store = cleanLabel(String(data?.store ?? "")) ?? "";
    const position = cleanLabel(String(data?.position ?? "")) ?? "";
    const offset = Math.max(0, Math.min(100_000, Math.floor(Number(data?.offset) || 0)));
    const sql = await db();
    const totals = await sql<{ n: number }>`
      select count(*)::int as n from submissions
      where (${pattern} = '' or full_name ilike ${pattern} or store_name ilike ${pattern} or store_code ilike ${pattern} or nik_mask ilike ${pattern})
        and (${store} = '' or store_name = ${store})
        and (${position} = '' or position_name = ${position})
    `;
    const rows = await sql<{
      id: string;
      receipt_code: string;
      full_name: string;
      nik_mask: string;
      store_name: string;
      store_code: string;
      position_name: string;
      consent_member: boolean;
      status: string;
      created_at: unknown;
    }>`
      select id, receipt_code, full_name, nik_mask, store_name, store_code, position_name,
             consent_member, status, created_at
      from submissions
      where (${pattern} = '' or full_name ilike ${pattern} or store_name ilike ${pattern} or store_code ilike ${pattern} or nik_mask ilike ${pattern})
        and (${store} = '' or store_name = ${store})
        and (${position} = '' or position_name = ${position})
      order by created_at desc
      limit 30 offset ${offset}
    `;
    if (offset === 0) {
      await writeAudit(context.userId, admin.email, "buka daftar", `filter toko=${store || "-"} jabatan=${position || "-"}`);
    }
    return { ok: true, rows: rows.map(mapRow), total: Number(totals[0]?.n ?? 0) };
  });

export const setSubmissionStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: SubmissionStatus }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const status: SubmissionStatus = data?.status === "verified" ? "verified" : "pending";
    const id = String(data?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Data tidak ditemukan.");
    const sql = await db();
    const updated = await sql<{ id: string }>`
      update submissions set status = ${status} where id = ${id} returning id
    `;
    if (!updated[0]) return fail("Data tidak ditemukan.");
    await writeAudit(context.userId, admin.email, "ubah status", `${id} -> ${status}`);
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; reason: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const id = String(data?.id ?? "");
    const reason = cleanLabel(String(data?.reason ?? ""), 3, 80);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !reason) return fail("Alasan hapus wajib diisi.");
    const sql = await db();
    const removed = await sql<{ id: string }>`
      delete from submissions where id = ${id} returning id
    `;
    if (!removed[0]) return fail("Data tidak ditemukan.");
    await writeAudit(context.userId, admin.email, "hapus", `${id} alasan: ${reason}`);
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SettingsInput) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const totalRaw = data?.totalEmployees;
    const total =
      totalRaw === null || totalRaw === undefined || String(totalRaw) === ""
        ? null
        : Math.floor(Number(totalRaw));
    if (total !== null && (!Number.isFinite(total) || total < 1 || total > 500_000)) {
      return fail("Jumlah karyawan harus kosong atau antara 1 dan 500.000.");
    }
    const percent = Math.floor(Number(data?.targetPercent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      return fail("Target persen harus 1–100.");
    }
    const statementText = String(data?.statementText ?? "").trim();
    const consentText = String(data?.consentText ?? "").trim();
    const contactName = cleanLabel(String(data?.contactName ?? ""), 3, 120);
    const contactDetail = cleanLabel(String(data?.contactDetail ?? ""), 3, 160);
    const retentionNote = String(data?.retentionNote ?? "").trim();
    if (statementText.length < 20 || statementText.length > 2000) {
      return fail("Teks pernyataan terlalu pendek atau terlalu panjang.");
    }
    if (consentText.length < 20 || consentText.length > 800) {
      return fail("Kalimat persetujuan terlalu pendek atau terlalu panjang.");
    }
    if (!contactName || !contactDetail) return fail("Nama dan kontak pengurus wajib diisi.");
    if (retentionNote.length < 20 || retentionNote.length > 1000) {
      return fail("Catatan retensi belum cukup jelas.");
    }
    const sql = await db();
    await sql`
      update settings set
        total_employees = ${total},
        target_percent = ${percent},
        statement_text = ${statementText},
        consent_text = ${consentText},
        contact_name = ${contactName},
        contact_detail = ${contactDetail},
        retention_note = ${retentionNote},
        updated_at = now()
      where id = 1
    `;
    await writeAudit(context.userId, admin.email, "ubah pengaturan", `karyawan=${total ?? "-"} target=${percent}%`);
    return { ok: true };
  });

export const addNames = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: "store" | "position"; raw: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true; added: number } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const kind = data?.kind === "position" ? "position" : "store";
    const names = parseLines(String(data?.raw ?? ""));
    if (names.length === 0) return fail("Belum ada nama yang bisa ditambahkan.");
    const sql = await db();
    let added = 0;
    for (const name of names) {
      if (kind === "store") {
        const before = await sql<{ id: number }>`
          select id from stores where lower(name) = lower(${name})
        `;
        if (before[0]) {
          await sql`update stores set active = true where id = ${before[0].id}`;
        } else {
          await sql`insert into stores (name) values (${name})`;
          added += 1;
        }
      } else {
        const before = await sql<{ id: number }>`
          select id from positions where lower(name) = lower(${name})
        `;
        if (before[0]) {
          await sql`update positions set active = true where id = ${before[0].id}`;
        } else {
          await sql`insert into positions (name, sort_order) values (${name}, ${50})`;
          added += 1;
        }
      }
    }
    await writeAudit(context.userId, admin.email, "tambah daftar", `${kind} +${added}`);
    return { ok: true, added };
  });

export const setNameActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: "store" | "position"; name: string; active: boolean }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const name = cleanLabel(String(data?.name ?? ""));
    if (!name) return fail("Nama tidak dikenali.");
    const active = data?.active === true;
    const sql = await db();
    if (!active && data?.kind === "position") {
      const left = await sql<{ n: number }>`
        select count(*)::int as n from positions
        where active = true and lower(name) <> lower(${name})
      `;
      if (Number(left[0]?.n ?? 0) < 1) return fail("Sisakan minimal satu jabatan aktif.");
    }
    if (data?.kind === "position") {
      await sql`update positions set active = ${active} where lower(name) = lower(${name})`;
    } else {
      await sql`update stores set active = ${active} where lower(name) = lower(${name})`;
    }
    await writeAudit(context.userId, admin.email, "ubah daftar", `${data?.kind} ${name} aktif=${active}`);
    return { ok: true };
  });

export const addAdminEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((email: string) => email)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const email = String(data ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return fail("Email pengurus tidak dikenali.");
    }
    const sql = await db();
    await sql`
      insert into admins (email) values (${email})
      on conflict (email) do nothing
    `;
    await writeAudit(context.userId, admin.email, "undang pengurus", email);
    return { ok: true };
  });

export const removeAdminEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((email: string) => email)
  .handler(async ({ context, data }): Promise<{ ok: true } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const email = String(data ?? "").trim().toLowerCase();
    const sql = await db();
    const countRows = await sql<{ n: number }>`select count(*)::int as n from admins`;
    if (Number(countRows[0]?.n ?? 0) <= 1) return fail("Pengurus terakhir tidak boleh dihapus.");
    await sql`delete from admins where lower(email) = ${email}`;
    await writeAudit(context.userId, admin.email, "hapus pengurus", email);
    return { ok: true };
  });

export type AuditRow = { id: number; email: string | null; action: string; detail: string | null; at: string };

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true; rows: AuditRow[] } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const sql = await db();
    const rows = await sql<{
      id: number;
      actor_email: string | null;
      action: string;
      detail: string | null;
      created_at: unknown;
    }>`
      select id, actor_email, action, detail, created_at
      from audit_log order by id desc limit 80
    `;
    return {
      ok: true,
      rows: rows.map((row) => ({
        id: Number(row.id),
        email: row.actor_email,
        action: row.action,
        detail: row.detail,
        at: formatWib(asDate(row.created_at)),
      })),
    };
  });

export const prepareExport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((includePending: boolean) => includePending === true)
  .handler(async ({ context, data: includePending }): Promise<{ ok: true; rows: OfficialRow[] } | Fail> => {
    await gate();
    const admin = await adminOf(context.userId);
    if (!admin) return fail("Akun ini bukan pengurus.");
    const sql = await db();
    const rows = await sql<{
      id: string;
      receipt_code: string;
      full_name: string;
      nik_mask: string;
      nik_cipher: string;
      store_name: string;
      store_code: string;
      position_name: string;
      consent_member: boolean;
      status: string;
      created_at: unknown;
      signature_png: string;
    }>`
      select id, receipt_code, full_name, nik_mask, nik_cipher, store_name, store_code, position_name,
             consent_member, status, created_at, signature_png
      from submissions
      where (${includePending} = true or status = 'verified')
      order by store_name asc, full_name asc
    `;
    const { decryptNik } = await import("./crypto.server");
    let official: OfficialRow[];
    try {
      official = rows.map((row) => ({
        ...mapRow(row),
        nik: decryptNik(row.nik_cipher),
        signaturePng: row.signature_png,
      }));
    } catch {
      return fail("NIK tidak bisa dibuka. Kunci enkripsi di server berbeda dengan saat data disimpan.");
    }
    await writeAudit(
      context.userId,
      admin.email,
      "ekspor nik utuh",
      `${official.length} baris, sertakan belum dicek: ${includePending ? "ya" : "tidak"}`,
    );
    return { ok: true, rows: official };
  });
