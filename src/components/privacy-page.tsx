import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Letterhead } from "@/components/letterhead";
import { getPublicCatalog } from "@/lib/dukungan/api";
import { COMPANY, ORG_SHORT, type PublicCatalog } from "@/lib/dukungan/types";

export function PrivacyPage() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  useEffect(() => {
    void getPublicCatalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <Letterhead
        action={
          <Link to="/" className="text-sm text-muted no-underline">
            Formulir
          </Link>
        }
      />
      <h1 className="mt-6 text-3xl">Kebijakan privasi</h1>
      <div className="mt-4 space-y-4 text-sm">
        <p>
          Pengendali data adalah pengurus {ORG_SHORT} {COMPANY}. Halaman ini menjelaskan pemakaian
          data sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Nomor pasal tidak
          dikutip di sini. [PERLU VERIFIKASI] bila pengurus ingin menambahkan rujukan pasal yang
          sudah dicek.
        </p>
        <h2 className="text-xl">Data yang dikumpulkan</h2>
        <p>Nama lengkap, NIK karyawan (Nomor Induk Karyawan, 10 angka), toko, kode toko, jabatan, tanda tangan, waktu kirim, serta pilihan bersedia atau tidak menjadi anggota. Tidak ada data lain.</p>
        <h2 className="text-xl">Tujuan</h2>
        <p>
          Menghitung dukungan agar PUK dapat bertindak dalam perundingan PKB, dan menyusun lampiran
          resmi bila pengurus memutuskan menyerahkannya ke perusahaan, Disnaker, atau federasi.
          Data tidak dijual, tidak dipasangi iklan, dan tidak dibagikan ke pihak lain di luar
          keputusan itu.
        </p>
        <h2 className="text-xl">Dasar</h2>
        <p>Persetujuan eksplisit pada kotak yang wajib dicentang. Tanpa centang, data tidak disimpan.</p>
        <h2 className="text-xl">Siapa yang bisa melihat</h2>
        <p>
          Pengunjung umum hanya melihat jumlah dukungan. Nama, NIK, dan tanda tangan tidak tampil di
          halaman publik. Pengurus yang akunnya terdaftar dapat melihat daftar. NIK utuh hanya saat
          ekspor resmi. NIK disimpan dalam bentuk terkunci.
        </p>
        <h2 className="text-xl">Hak Anda</h2>
        <p>
          Anda dapat meminta pengurus menunjukkan, memperbaiki, atau menghapus data Anda. Hapus
          dilakukan di ruang pengurus dan dicatat tanpa menyimpan NIK di catatan akses.
        </p>
        <h2 className="text-xl">Retensi</h2>
        <p>{catalog?.retentionNote ?? "Memuat catatan retensi…"}</p>
        <h2 className="text-xl">Risiko</h2>
        <p>
          Dukungan tidak dipajang, tetapi tekanan di tempat kerja tetap mungkin. Jangan sebarkan
          bukti ke grup kerja. Hubungi pengurus bila ada intimidasi.
        </p>
        <h2 className="text-xl">Kontak</h2>
        <p>
          {catalog?.contactName ?? "Pengurus"} — {catalog?.contactDetail ?? "kontak menyusul"}
        </p>
        <p>
          <Link to="/">Kembali ke formulir</Link>
        </p>
      </div>
    </main>
  );
}
