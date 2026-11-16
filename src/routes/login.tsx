import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Letterhead } from "@/components/letterhead";

export const Route = createFileRoute("/login")({ component: Login });

/** Google/X hanya berfungsi di pratinjau Grok — broker-nya tidak menerima server ini. */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? "Gagal. Periksa isian, lalu coba lagi.");
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Gagal terhubung. Periksa jaringan, lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6">
      <Letterhead />
      <h1 className="mt-6 text-3xl">Masuk pengurus</h1>
      <p className="mt-2 text-sm text-muted">
        Karyawan tidak perlu akun untuk mengisi dukungan. Halaman ini hanya untuk pengurus.
        Masuk dengan email dan kata sandi. Nyalakan verifikasi dua langkah di email Anda.
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
          <>
            <div className="flex gap-2">
              <button
                type="button"
                className={mode === "in" ? "btn btn-primary" : "btn btn-line"}
                onClick={() => {
                  setMode("in");
                  setError("");
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                className={mode === "up" ? "btn btn-primary" : "btn btn-line"}
                onClick={() => {
                  setMode("up");
                  setError("");
                }}
              >
                Daftar akun baru
              </button>
            </div>
            <form className="mt-4" onSubmit={onEmailSubmit}>
              {mode === "up" && (
                <>
                  <label className="block text-sm font-semibold" htmlFor="nama-pengurus">
                    Nama *
                  </label>
                  <input
                    id="nama-pengurus"
                    className="field mt-1"
                    autoComplete="name"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                  />
                </>
              )}
              <label className="mt-4 block text-sm font-semibold" htmlFor="email-pengurus">
                Email *
              </label>
              <input
                id="email-pengurus"
                className="field mt-1"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label className="mt-4 block text-sm font-semibold" htmlFor="sandi-pengurus">
                Kata sandi *
              </label>
              <input
                id="sandi-pengurus"
                className="field mt-1"
                type="password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === "up" && (
                <p className="mt-1 text-sm text-muted">Minimal 8 karakter.</p>
              )}
              {error && (
                <p className="mt-4 text-sm text-primary" role="alert">
                  {error}
                </p>
              )}
              <button className="btn btn-primary mt-4 w-full" type="submit" disabled={busy}>
                {busy ? "Memproses…" : mode === "up" ? "Daftar dan masuk" : "Masuk"}
              </button>
            </form>
            {inLivePreview() && (
              <>
                <p className="mt-6 text-center text-sm text-muted">atau</p>
                <div className="mt-2 flex flex-col gap-2">
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
              </>
            )}
          </>
        )}
      </div>
      <p className="mt-4 text-sm">
        <Link to="/">Kembali ke formulir</Link>
      </p>
    </main>
  );
}
