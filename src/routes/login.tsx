import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Letterhead } from "@/components/letterhead";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6">
      <Letterhead />
      <h1 className="mt-6 text-3xl">Masuk pengurus</h1>
      <p className="mt-2 text-sm text-muted">
        Karyawan tidak perlu akun untuk mengisi dukungan. Halaman ini hanya untuk pengurus.
        Gunakan akun Google atau X yang sama dengan email yang didaftarkan. Nyalakan verifikasi
        dua langkah di akun tersebut.
      </p>
      <div className="sheet mt-5 p-4">
        <div className="sheet-bar -mx-4 -mt-4 mb-4" />
        {isPending && <p className="text-sm text-muted">Memeriksa sesi…</p>}
        {!isPending && user && (
          <div className="space-y-3">
            <p className="text-sm">Anda sudah masuk.</p>
            <UserButton />
            <Link to="/admin" className="btn btn-primary inline-flex items-center no-underline">
              Buka ruang pengurus
            </Link>
          </div>
        )}
        {!isPending && !user && (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="btn btn-line"
                onClick={() => signIn(provider.providerId, { callbackURL: "/admin" })}
              >
                Masuk dengan {provider.label === "twitter" ? "X" : provider.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link to="/">Kembali ke formulir</Link>
      </p>
    </main>
  );
}
