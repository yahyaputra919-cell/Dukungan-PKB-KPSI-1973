import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Scale, ShieldCheck, TriangleAlert } from "lucide-react";
import { Letterhead } from "@/components/letterhead";
import { SignaturePad, type SignatureHandle } from "@/components/signature-pad";
import { getPublicCatalog, submitSupport } from "@/lib/dukungan/api";
import { formatPct } from "@/lib/dukungan/format";
import { APP_TITLE, COMPANY, ORG_SHORT, type PublicCatalog, type SubmitOk } from "@/lib/dukungan/types";

export function PublicPage() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [nik, setNik] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeOpen, setStoreOpen] = useState(false);
  const [positionName, setPositionName] = useState("");
  const [consent, setConsent] = useState(false);
  const [member, setMember] = useState(false);
  const [answer, setAnswer] = useState("");
  const [hpField, setHpField] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<SubmitOk | null>(null);
  const signRef = useRef<SignatureHandle>(null);

  useEffect(() => {
    let alive = true;
    getPublicCatalog()
      .then((next) => {
        if (alive) setCatalog(next);
      })
      .catch(() => {
        if (alive) setLoadError("Halaman gagal dimuat. Periksa jaringan, lalu coba lagi.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const progress = catalog?.progress;
  const bar =
    progress?.targetCount && progress.targetCount > 0
      ? Math.min(100, Math.round((progress.submitted / progress.targetCount) * 100))
      : 0;
  const storeQuery = storeName.trim().toLocaleLowerCase("id");
  const storeOptions = (catalog?.stores ?? [])
    .filter((name) => name.toLocaleLowerCase("id").includes(storeQuery))
    .slice(0, 8);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!catalog || pending) return;
    setError("");
    if (!signRef.current || signRef.current.isEmpty()) {
      setError("Tanda tangan masih kosong. Gambar di kotak, lalu kirim lagi.");
      return;
    }
    setPending(true);
    try {
      const result = await submitSupport({
        data: {
          fullName,
          nik,
          storeName,
          positionName,
          signaturePng: signRef.current.toDataURL(),
          consentRepresent: consent,
          consentMember: member,
          challengeToken: catalog.challenge.token,
          challengeAnswer: answer,
          hpField,
        },
      });
      if (!result.ok) {
        setError(result.message);
        if (result.code === "challenge" || result.code === "rate") {
          const next = await getPublicCatalog();
          setCatalog(next);
          setAnswer("");
        }
        return;
      }
      setDone(result);
      const next = await getPublicCatalog().catch(() => null);
      if (next) setCatalog(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Kiriman gagal sampai. Periksa jaringan, lalu coba sekali lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Letterhead
        action={
          <Link to="/admin" className="no-print text-sm text-muted no-underline">
            Pengurus
          </Link>
        }
      />
      <p className="mt-6 text-sm font-semibold tracking-wide text-primary uppercase">Bukan situs perusahaan</p>
      <h1 className="mt-1 text-3xl text-ink">{APP_TITLE}</h1>
      <p className="mt-3 text-base text-ink">
        Formulir ini untuk karyawan {COMPANY} yang ingin memberi dukungan kepada {ORG_SHORT} agar
        dapat mewakili perundingan PKB.
      </p>

      <section className="sheet mt-5">
        <div className="sheet-bar" />
        <div className="divide-y divide-line px-4">
          <Fold icon={<Scale className="size-4" />} title="Apa itu PKB?">
            PKB artinya Perjanjian Kerja Bersama: kesepakatan serikat pekerja dan perusahaan tentang
            syarat kerja, hak, dan kewajiban. PKB dibuat lewat perundingan.
          </Fold>
          <Fold icon={<ShieldCheck className="size-4" />} title="Kenapa dukungan ini diminta?">
            Jumlah anggota PUK saat ini belum cukup untuk mewakili perundingan PKB. Target pengurus:
            dukungan lebih dari setengah jumlah karyawan. Angka setengah itu target organisasi, bukan
            kutipan pasal. [PERLU VERIFIKASI] bersama federasi dan Disnaker apakah dukungan dari
            karyawan yang belum menjadi anggota dihitung untuk keterwakilan.
          </Fold>
          <Fold icon={<Lock className="size-4" />} title="Apa yang terjadi pada data saya?">
            Yang disimpan hanya nama, NIK, toko, jabatan, tanda tangan, dan pilihan Anda. NIK dikunci
            di database. Halaman ini tidak menampilkan nama siapa pun. Tidak ada iklan dan tidak ada
            pelacak. Data tidak dikirim ke perusahaan kecuali pengurus memutuskan menyerahkan rekap
            resmi ke perusahaan, Disnaker, atau federasi.
          </Fold>
          <Fold icon={<TriangleAlert className="size-4" />} title="Risiko di tempat kerja">
            Nama pendukung tidak tampil di halaman umum. Tetap ada kemungkinan tekanan. Isi dari HP
            pribadi, jangan kirim tangkapan layar bukti ke grup kerja, dan hubungi pengurus jika ada
            intimidasi.
          </Fold>
        </div>
      </section>

      <section className="sheet mt-4 p-4" aria-live="polite">
        <div className="sheet-bar -mx-4 -mt-4 mb-4" />
        <h2 className="text-xl">Progres dukungan</h2>
        {!progress && !loadError && <p className="mt-2 text-sm text-muted">Memuat angka…</p>}
        {loadError && <p className="mt-2 text-sm text-primary">{loadError}</p>}
        {progress && (
          <>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {progress.submitted}
              <span className="text-base font-normal text-muted">
                {" "}
                pernyataan masuk
                {progress.targetCount ? ` / target ${progress.targetCount}` : ""}
              </span>
            </p>
            {progress.targetCount ? (
              <>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.targetCount}
                  aria-valuenow={Math.min(progress.submitted, progress.targetCount)}
                >
                  <div className="h-full bg-primary" style={{ width: `${bar}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {formatPct(progress.submitted, progress.totalEmployees ?? progress.targetCount)}% dari{" "}
                  {progress.totalEmployees} karyawan. Target pengurus {progress.targetPercent}% (
                  {progress.targetCount} orang). Sudah dicek pengurus: {progress.verified}.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Jumlah karyawan belum diatur pengurus, jadi persentase belum ditampilkan. Yang terlihat
                di sini hanya angka, tanpa nama.
              </p>
            )}
          </>
        )}
      </section>

      {done ? (
        <section className="sheet mt-4 p-4" id="form">
          <div className="sheet-bar -mx-4 -mt-4 mb-4" />
          <h2 className="text-2xl">Dukungan tercatat</h2>
          <p className="mt-2">
            Simpan nomor bukti ini. NIK utuh tidak ditampilkan. Jangan kirim tangkapan layar ini ke grup
            kerja.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Item term="Nomor bukti" value={done.receipt} />
            <Item term="Nama" value={done.fullName} />
            <Item term="NIK" value={done.nikMask} />
            <Item term="Toko" value={done.storeName} />
            <Item term="Jabatan" value={done.positionName} />
            <Item term="Waktu" value={done.at} />
            <Item term="Bersedia jadi anggota" value={done.consentMember ? "Ya" : "Tidak"} />
          </dl>
        </section>
      ) : (
        <form id="form" className="sheet mt-4 p-4" onSubmit={onSubmit} noValidate>
          <div className="sheet-bar -mx-4 -mt-4 mb-4" />
          <h2 className="text-2xl">Formulir dukungan</h2>
          <p className="mt-2 text-sm text-muted">Satu NIK hanya bisa mengirim satu kali. Isian wajib bertanda *.</p>
          {catalog && <p className="note mt-4">{catalog.statementText}</p>}

          <label className="mt-4 block text-sm font-semibold" htmlFor="nama">
            Nama lengkap *
          </label>
          <input
            id="nama"
            className="field mt-1"
            autoComplete="name"
            value={fullName}
            maxLength={80}
            onChange={(event) => setFullName(event.target.value)}
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="nik">
            NIK *
          </label>
          <input
            id="nik"
            className="field mt-1 tabular-nums"
            inputMode="numeric"
            autoComplete="off"
            value={nik}
            onChange={(event) => setNik(event.target.value.replace(/\D/g, "").slice(0, 16))}
            aria-describedby="nik-hint"
          />
          <p id="nik-hint" className="mt-1 text-sm text-muted">
            {nik.length}/16 angka. Contoh format dicek di tempat, bukan dicek ke Dukcapil.
          </p>

          <label className="mt-4 block text-sm font-semibold" htmlFor="toko">
            Toko *
          </label>
          <div className="relative mt-1">
            <input
              id="toko"
              className="field"
              role="combobox"
              aria-expanded={storeOpen}
              aria-autocomplete="list"
              value={storeName}
              maxLength={80}
              onChange={(event) => {
                setStoreName(event.target.value);
                setStoreOpen(true);
              }}
              onFocus={() => setStoreOpen(true)}
              onBlur={() => setStoreOpen(false)}
            />
            {storeOpen && (storeOptions.length > 0 || storeName.trim().length >= 2) && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-sheet shadow-sm">
                {storeOptions.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="min-h-11 w-full px-3 text-left hover:bg-paper"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setStoreName(name);
                        setStoreOpen(false);
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
                {storeName.trim().length >= 2 &&
                  !storeOptions.some(
                    (name) => name.toLocaleLowerCase("id") === storeName.trim().toLocaleLowerCase("id"),
                  ) && (
                    <li>
                      <button
                        type="button"
                        className="min-h-11 w-full px-3 text-left hover:bg-paper"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setStoreOpen(false);
                        }}
                      >
                        Pakai “{storeName.trim()}”
                      </button>
                    </li>
                  )}
              </ul>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Ketik untuk mencari. Jika toko belum ada di daftar, nama yang Anda ketik tetap dipakai.</p>

          <label className="mt-4 block text-sm font-semibold" htmlFor="jabatan">
            Jabatan *
          </label>
          <select
            id="jabatan"
            className="field mt-1"
            value={positionName}
            onChange={(event) => setPositionName(event.target.value)}
          >
            <option value="">Pilih jabatan</option>
            {(catalog?.positions ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Tanda tangan *</p>
              <button
                type="button"
                className="text-sm text-primary"
                onClick={() => signRef.current?.clear()}
              >
                Hapus dan ulang
              </button>
            </div>
            <div className="mt-1 overflow-hidden rounded-md border border-line">
              <SignaturePad ref={signRef} />
            </div>
            <p className="mt-1 text-sm text-muted">Gambar dengan jari atau mouse di dalam kotak.</p>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{catalog?.consentText ?? "Memuat kalimat persetujuan…"} *</span>
          </label>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={member}
              onChange={(event) => setMember(event.target.checked)}
            />
            <span>Saya juga bersedia menjadi anggota serikat. (tidak wajib)</span>
          </label>

          <label className="hp" htmlFor="hp">
            Kosongkan
            <input id="hp" tabIndex={-1} autoComplete="off" value={hpField} onChange={(event) => setHpField(event.target.value)} />
          </label>

          {catalog && (
            <>
              <label className="mt-4 block text-sm font-semibold" htmlFor="aman">
                Agar ini bukan robot: berapa {catalog.challenge.a} + {catalog.challenge.b}? *
              </label>
              <input
                id="aman"
                className="field mt-1 tabular-nums"
                inputMode="numeric"
                autoComplete="off"
                value={answer}
                onChange={(event) => setAnswer(event.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </>
          )}

          {error && (
            <p className="mt-4 text-sm text-primary" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary mt-4 w-full" type="submit" disabled={pending || !catalog}>
            {pending ? "Mengirim…" : "Kirim dukungan"}
          </button>
        </form>
      )}

      <footer className="mt-6 space-y-2 pb-8 text-sm text-muted">
        <p>
          Kontak pengurus: {catalog?.contactName ?? "Sekretaris Jenderal"} —{" "}
          {catalog?.contactDetail ?? "kontak menyusul"}
        </p>
        <p>
          <Link to="/privasi">Kebijakan privasi dan retensi data</Link>
        </p>
      </footer>
    </main>
  );
}

function Fold({ icon, title, children }: { icon: ReactNode; title: string; children: string }) {
  return (
    <details className="fold">
      <summary>
        <span className="mr-2 text-primary">{icon}</span>
        {title}
      </summary>
      <p className="pb-2 text-sm">{children}</p>
    </details>
  );
}

function Item({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2">
      <dt className="text-muted">{term}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
