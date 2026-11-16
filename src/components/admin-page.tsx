import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Letterhead } from "@/components/letterhead";
import {
  addAdminEmail,
  addNames,
  claimAdmin,
  deleteSubmission,
  getAdminHome,
  listAudit,
  listSubmissions,
  prepareExport,
  removeAdminEmail,
  saveSettings,
  setNameActive,
  setSubmissionStatus,
  type AdminHome,
  type AuditRow,
} from "@/lib/dukungan/api";
import { formatPct } from "@/lib/dukungan/format";
import type { OfficialRow, SettingsInput, SubmissionRow } from "@/lib/dukungan/types";
import { buildSupportXls } from "@/lib/dukungan/xls";

const REASONS = ["Permintaan pemilik data", "Duplikat atau salah kirim", "Data tidak valid"];

export function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <p className="text-muted">Memeriksa akun pengurus…</p>
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return <AdminBody />;
}

function AdminBody() {
  const [home, setHome] = useState<AdminHome | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setError("");
    try {
      const next = await getAdminHome();
      setHome(next);
    } catch (err) {
      setError(err instanceof Error && err.message === "Unauthorized" ? "Sesi berakhir. Masuk lagi." : "Ruang pengurus gagal dimuat.");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  if (!home && !error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <p className="text-muted">Memuat ruang pengurus…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="no-print">
        <Letterhead
          action={
            <div className="flex items-center gap-3">
              <Link to="/" className="text-sm text-muted no-underline">
                Formulir
              </Link>
              <UserButton />
            </div>
          }
        />
        <h1 className="mt-6 text-3xl">Ruang pengurus</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Hanya akun yang sudah diaktifkan. NIK di daftar disamarkan. NIK utuh hanya muncul saat
          menyiapkan lampiran resmi, dan tindakan itu dicatat.
        </p>
        {error && <p className="mt-4 text-sm text-primary">{error}</p>}
        {home?.ok && !home.isAdmin && (
          <Claim
            email={home.email}
            adminCount={home.adminCount}
            code={code}
            setCode={setCode}
            busy={busy}
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const result = await claimAdmin({ data: code });
                if (!result.ok) setError(result.message);
                else await reload();
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {home?.ok && home.isAdmin && <Dashboard home={home} onChanged={reload} />}
      </div>
    </main>
  );
}

function Claim({
  email,
  adminCount,
  code,
  setCode,
  busy,
  onSubmit,
}: {
  email: string | null;
  adminCount: number;
  code: string;
  setCode: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="sheet mt-5 max-w-lg p-4" onSubmit={onSubmit}>
      <div className="sheet-bar -mx-4 -mt-4 mb-4" />
      <h2 className="text-2xl">{adminCount === 0 ? "Aktivasi pengurus pertama" : "Akun belum terdaftar"}</h2>
      <p className="mt-2 text-sm">
        Masuk sebagai <strong>{email ?? "tanpa email"}</strong>.
      </p>
      {adminCount === 0 ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Masukkan kode aktivasi yang diberikan saat situs ini dibuat. Setelah pengurus pertama
            aktif, kode ini tidak bisa dipakai lagi. Pengurus lain ditambahkan lewat email.
          </p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="kode">
            Kode aktivasi
          </label>
          <input id="kode" className="field mt-1" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
          <button className="btn btn-primary mt-4" type="submit" disabled={busy}>
            {busy ? "Memeriksa…" : "Aktifkan akun ini"}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm">
          Minta Sekretaris Jenderal menambahkan email ini di daftar pengurus, lalu masuk lagi dengan akun yang sama.
        </p>
      )}
    </form>
  );
}

function Dashboard({ home, onChanged }: { home: Extract<AdminHome, { isAdmin: true }>; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<"ringkas" | "daftar" | "atur" | "akses">("ringkas");
  const [notice, setNotice] = useState("");
  const progress = home.progress;
  const whole = progress.totalEmployees ?? 0;

  return (
    <>
      {home.keyMode === "preview" && (
        <p className="note mt-4">
          Kunci enkripsi masih mode latihan (sidik {home.keyFingerprint}). Jangan kumpulkan NIK
          sungguhan sebelum kunci server dipasang. Mengganti kunci membuat NIK lama tidak bisa dibuka.
        </p>
      )}
      {home.keyMode === "host" && (
        <p className="note mt-4">
          NIK dikunci dengan rahasia server (sidik {home.keyFingerprint}). Jangan mengganti rahasia itu
          setelah data masuk.
        </p>
      )}
      {home.keyMode === "explicit" && (
        <p className="note mt-4">Kunci khusus NIK aktif. Sidik kunci: {home.keyFingerprint}.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["ringkas", "Ringkasan"],
            ["daftar", "Daftar"],
            ["atur", "Pengaturan"],
            ["akses", "Akses"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn btn-primary" : "btn btn-line"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}

      {tab === "ringkas" && (
        <section className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Masuk" value={String(progress.submitted)} />
            <Stat label="Sudah dicek" value={String(progress.verified)} />
            <Stat
              label="Terhadap karyawan"
              value={whole ? `${formatPct(progress.submitted, whole)}%` : "Belum diatur"}
            />
          </div>
          <p className="text-sm text-muted">
            Target organisasi {progress.targetPercent}%
            {progress.targetCount ? ` = ${progress.targetCount} orang` : ""}. Angka ini bukan kutipan
            undang-undang. [PERLU VERIFIKASI] apakah dukungan non-anggota dihitung untuk keterwakilan PKB.
          </p>
          <div className="sheet p-4">
            <h2 className="text-xl">Per toko</h2>
            {home.byStore.length === 0 && <p className="mt-2 text-sm text-muted">Belum ada dukungan.</p>}
            <ul className="mt-2 space-y-2 text-sm">
              {home.byStore.map((row) => (
                <li key={row.storeName} className="flex justify-between gap-3 border-b border-line pb-2">
                  <span>{row.storeName}</span>
                  <span className="tabular-nums text-muted">
                    {row.total} masuk · {row.verified} dicek
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="note">
            <p className="font-semibold">Sebelum link dibagikan ke karyawan</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Isi kontak pengurus yang bisa dihubungi.</li>
              <li>Isi jumlah karyawan dan tempel daftar toko.</li>
              <li>Cek kalimat dukungan bersama federasi atau Disnaker.</li>
              <li>Tambahkan email pengurus lain.</li>
              <li>Uji kirim satu data, lihat di daftar, lalu hapus.</li>
              <li>Jangan tampilkan nama di pengumuman publik. Lampiran resmi hanya lewat keputusan pengurus.</li>
            </ul>
          </div>
          <ExportPanel onNotice={setNotice} />
        </section>
      )}
      {tab === "daftar" && <ListPanel stores={home.byStore.map((row) => row.storeName)} positions={home.positions.map((row) => row.name)} onChanged={onChanged} onNotice={setNotice} />}
      {tab === "atur" && <SettingsPanel home={home} onChanged={onChanged} onNotice={setNotice} />}
      {tab === "akses" && <AccessPanel home={home} onChanged={onChanged} onNotice={setNotice} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sheet p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ListPanel({
  stores,
  positions,
  onChanged,
  onNotice,
}: {
  stores: string[];
  positions: string[];
  onChanged: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const [store, setStore] = useState("");
  const [position, setPosition] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [deleteId, setDeleteId] = useState("");
  const [reason, setReason] = useState(REASONS[0]);

  async function load(nextOffset: number) {
    const result = await listSubmissions({ data: { q, store, position, offset: nextOffset } });
    if (!result.ok) {
      onNotice(result.message);
      return;
    }
    setRows(result.rows);
    setTotal(result.total);
    setOffset(nextOffset);
  }

  useEffect(() => {
    void load(0);
    // Muat pertama kali. Pencarian berikutnya lewat tombol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mt-4">
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void load(0);
        }}
      >
        <input className="field sm:col-span-2" placeholder="Cari nama atau toko" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="field" value={store} onChange={(event) => setStore(event.target.value)}>
          <option value="">Semua toko</option>
          {stores.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select className="field" value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="">Semua jabatan</option>
          {positions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button className="btn btn-line sm:col-span-4" type="submit">Cari</button>
      </form>
      <p className="mt-3 text-sm text-muted">{total} data. NIK disamarkan.</p>
      <div className="table-wrap mt-2">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>NIK</th>
              <th>Toko</th>
              <th>Jabatan</th>
              <th>Anggota</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.fullName}</td>
                <td className="tabular-nums">{row.nikMask}</td>
                <td>{row.storeName}</td>
                <td>{row.positionName}</td>
                <td>{row.consentMember ? "Ya" : "Tidak"}</td>
                <td>{row.status === "verified" ? "Sudah dicek" : "Belum dicek"}</td>
                <td className="tabular-nums">{row.at}</td>
                <td className="space-y-2">
                  <button
                    type="button"
                    className="btn btn-line"
                    onClick={async () => {
                      const result = await setSubmissionStatus({
                        data: { id: row.id, status: row.status === "verified" ? "pending" : "verified" },
                      });
                      if (!result.ok) onNotice(result.message);
                      else {
                        await load(offset);
                        await onChanged();
                      }
                    }}
                  >
                    {row.status === "verified" ? "Batal dicek" : "Tandai dicek"}
                  </button>
                  <button type="button" className="btn btn-line" onClick={() => setDeleteId(row.id)}>
                    Hapus
                  </button>
                  {deleteId === row.id && (
                    <div className="space-y-2">
                      <select className="field" value={reason} onChange={(event) => setReason(event.target.value)}>
                        {REASONS.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={async () => {
                          const result = await deleteSubmission({ data: { id: row.id, reason } });
                          if (!result.ok) onNotice(result.message);
                          else {
                            setDeleteId("");
                            await load(offset);
                            await onChanged();
                          }
                        }}
                      >
                        Hapus permanen
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="mt-3 text-sm text-muted">Tidak ada data untuk filter ini.</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-line" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - 30))}>
          Sebelumnya
        </button>
        <button type="button" className="btn btn-line" disabled={offset + 30 >= total} onClick={() => void load(offset + 30)}>
          Berikutnya
        </button>
      </div>
    </section>
  );
}

function SettingsPanel({
  home,
  onChanged,
  onNotice,
}: {
  home: Extract<AdminHome, { isAdmin: true }>;
  onChanged: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [draft, setDraft] = useState<SettingsInput>(home.settings);
  const [storeRaw, setStoreRaw] = useState("");
  const [positionRaw, setPositionRaw] = useState("");

  function set<K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <form
        className="sheet p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await saveSettings({ data: draft });
          if (!result.ok) onNotice(result.message);
          else {
            onNotice("Pengaturan disimpan.");
            await onChanged();
          }
        }}
      >
        <h2 className="text-xl">Angka dan teks</h2>
        <label className="mt-3 block text-sm font-semibold" htmlFor="total">
          Jumlah karyawan
        </label>
        <input
          id="total"
          className="field mt-1"
          inputMode="numeric"
          value={draft.totalEmployees ?? ""}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "");
            set("totalEmployees", raw ? Number(raw) : null);
          }}
        />
        <label className="mt-3 block text-sm font-semibold" htmlFor="persen">
          Target organisasi (%)
        </label>
        <input
          id="persen"
          className="field mt-1"
          inputMode="numeric"
          value={draft.targetPercent}
          onChange={(event) => set("targetPercent", Number(event.target.value.replace(/\D/g, "") || 0))}
        />
        <p className="mt-1 text-sm text-muted">Bukan kutipan pasal. Ubah bila federasi memberi angka lain.</p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="pernyataan">Teks pengantar</label>
        <textarea id="pernyataan" className="field mt-1" value={draft.statementText} onChange={(event) => set("statementText", event.target.value)} />
        <label className="mt-3 block text-sm font-semibold" htmlFor="setuju">Kalimat persetujuan</label>
        <textarea id="setuju" className="field mt-1" value={draft.consentText} onChange={(event) => set("consentText", event.target.value)} />
        <label className="mt-3 block text-sm font-semibold" htmlFor="kontak-nama">Nama kontak</label>
        <input id="kontak-nama" className="field mt-1" value={draft.contactName} onChange={(event) => set("contactName", event.target.value)} />
        <label className="mt-3 block text-sm font-semibold" htmlFor="kontak">Kontak (WhatsApp atau email)</label>
        <input id="kontak" className="field mt-1" value={draft.contactDetail} onChange={(event) => set("contactDetail", event.target.value)} />
        <label className="mt-3 block text-sm font-semibold" htmlFor="retensi">Catatan retensi</label>
        <textarea id="retensi" className="field mt-1" value={draft.retentionNote} onChange={(event) => set("retentionNote", event.target.value)} />
        <button className="btn btn-primary mt-4" type="submit">Simpan</button>
      </form>
      <div className="space-y-4">
        <NameBox
          title="Daftar toko"
          hint="Satu nama toko per baris. Karyawan tetap bisa mengetik toko yang belum ada."
          raw={storeRaw}
          setRaw={setStoreRaw}
          names={home.stores}
          onAdd={async () => {
            const result = await addNames({ data: { kind: "store", raw: storeRaw } });
            if (!result.ok) onNotice(result.message);
            else {
              setStoreRaw("");
              onNotice(`${result.added} toko baru ditambahkan.`);
              await onChanged();
            }
          }}
          onToggle={async (name, active) => {
            const result = await setNameActive({ data: { kind: "store", name, active } });
            if (!result.ok) onNotice(result.message);
            else await onChanged();
          }}
        />
        <NameBox
          title="Daftar jabatan"
          hint="Jabatan yang tidak aktif hilang dari formulir."
          raw={positionRaw}
          setRaw={setPositionRaw}
          names={home.positions}
          onAdd={async () => {
            const result = await addNames({ data: { kind: "position", raw: positionRaw } });
            if (!result.ok) onNotice(result.message);
            else {
              setPositionRaw("");
              onNotice(`${result.added} jabatan baru ditambahkan.`);
              await onChanged();
            }
          }}
          onToggle={async (name, active) => {
            const result = await setNameActive({ data: { kind: "position", name, active } });
            if (!result.ok) onNotice(result.message);
            else await onChanged();
          }}
        />
      </div>
    </section>
  );
}

function NameBox({
  title,
  hint,
  raw,
  setRaw,
  names,
  onAdd,
  onToggle,
}: {
  title: string;
  hint: string;
  raw: string;
  setRaw: (value: string) => void;
  names: { name: string; active: boolean }[];
  onAdd: () => Promise<void>;
  onToggle: (name: string, active: boolean) => Promise<void>;
}) {
  return (
    <div className="sheet p-4">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <textarea className="field mt-3" value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={"Contoh Toko 1\nContoh Toko 2"} />
      <button type="button" className="btn btn-line mt-3" onClick={() => void onAdd()}>
        Tambahkan
      </button>
      <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
        {names.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2">
            <span className={item.active ? "" : "text-muted"}>{item.name}</span>
            <button type="button" className="text-sm text-primary" onClick={() => void onToggle(item.name, !item.active)}>
              {item.active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccessPanel({
  home,
  onChanged,
  onNotice,
}: {
  home: Extract<AdminHome, { isAdmin: true }>;
  onChanged: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    void listAudit().then((result) => {
      if (result.ok) setRows(result.rows);
    });
  }, [home.admins.length]);

  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="sheet p-4">
        <h2 className="text-xl">Pengurus</h2>
        <p className="mt-1 text-sm text-muted">
          Mereka masuk dengan Google atau X. Aktifkan verifikasi dua langkah di akun Google atau X mereka.
          Situs ini tidak menambah metode masuk lain.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {home.admins.map((admin) => (
            <li key={admin.email} className="flex items-center justify-between gap-2">
              <span>{admin.email}</span>
              <button
                type="button"
                className="text-sm text-primary"
                onClick={async () => {
                  const result = await removeAdminEmail({ data: admin.email });
                  if (!result.ok) onNotice(result.message);
                  else await onChanged();
                }}
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await addAdminEmail({ data: email });
            if (!result.ok) onNotice(result.message);
            else {
              setEmail("");
              await onChanged();
            }
          }}
        >
          <input className="field" type="email" placeholder="email pengurus" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="btn btn-primary" type="submit">Tambah</button>
        </form>
      </div>
      <div className="sheet p-4">
        <h2 className="text-xl">Catatan akses</h2>
        <p className="mt-1 text-sm text-muted">Membuka NIK utuh, menghapus data, dan mengubah pengaturan tercatat di sini. NIK karyawan tidak ditulis di catatan ini.</p>
        <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-sm">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-line pb-2">
              <p className="font-semibold">{row.action}</p>
              <p className="text-muted">{row.at} · {row.email}</p>
              {row.detail && <p>{row.detail}</p>}
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted">Belum ada catatan.</li>}
        </ul>
      </div>
    </section>
  );
}

function ExportPanel({ onNotice }: { onNotice: (value: string) => void }) {
  const [includePending, setIncludePending] = useState(false);
  const [rows, setRows] = useState<OfficialRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="sheet p-4">
      <h2 className="text-xl">Lampiran resmi</h2>
      <p className="mt-2 text-sm">
        Excel berisi data. PDF memuat tanda tangan. NIK utuh hanya ada di kedua berkas ini. Jangan
        meneruskannya ke grup yang tidak perlu. Secara bawaan hanya data yang sudah dicek.
      </p>
      <label className="mt-3 flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-5" checked={includePending} onChange={(event) => setIncludePending(event.target.checked)} />
        <span>Sertakan yang belum dicek. Jangan dipakai sebagai lampiran final.</span>
      </label>
      <button
        type="button"
        className="btn btn-primary mt-4"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          onNotice("");
          try {
            const result = await prepareExport({ data: includePending });
            if (!result.ok) onNotice(result.message);
            else {
              setRows(result.rows);
              requestAnimationFrame(() => document.getElementById("lampiran")?.scrollIntoView({ behavior: "smooth" }));
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Menyiapkan…" : "Siapkan lampiran"}
      </button>
      {rows && rows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-line"
            onClick={() => {
              const blob = new Blob([buildSupportXls(rows)], { type: "application/vnd.ms-excel" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "daftar-dukungan-pkb.xls";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Unduh Excel
          </button>
          <button type="button" className="btn btn-line" onClick={() => window.print()}>
            Cetak atau simpan PDF
          </button>
        </div>
      )}
      {rows &&
        createPortal(
          <div id="lampiran" className="mx-auto w-full max-w-5xl px-4 pb-10">
            <OfficialSheet rows={rows} />
          </div>,
          document.body,
        )}
    </section>
  );
}

function OfficialSheet({ rows }: { rows: OfficialRow[] }) {
  return (
    <article className="official mt-4 bg-sheet p-2 text-ink">
      <h2 className="text-2xl">Daftar pernyataan dukungan</h2>
      <p className="text-sm">PUK K-SPSI 1973 PT. Indomarco Prismatama</p>
      <p className="mt-1 text-sm">
        {rows.length} baris. Keterwakilan hukum masih [PERLU VERIFIKASI]. Dokumen ini bukan
        penetapan Disnaker.
      </p>
      <div className="table-wrap mt-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>NIK</th>
              <th>Toko</th>
              <th>Jabatan</th>
              <th>Tanda tangan</th>
              <th>Tanggal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{row.fullName}</td>
                <td className="tabular-nums">{row.nik}</td>
                <td>{row.storeName}</td>
                <td>{row.positionName}</td>
                <td>
                  <img src={row.signaturePng} alt={`Tanda tangan ${row.fullName}`} className="h-12 w-28 object-contain" />
                </td>
                <td>{row.at}</td>
                <td>{row.status === "verified" ? "Sudah dicek" : "Belum dicek"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
