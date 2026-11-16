/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * ENABLED: this is how pengurus sign in on the self-hosted VPS, where the
 * Grok broker's Google/X buttons cannot work (the broker only accepts
 * callbacks on *.grok-sandbox.com). Forms live in `src/routes/login.tsx`
 * (`authClient.signUp.email` / `authClient.signIn.email`).
 *
 * Do NOT edit `server.ts` for this — except the plain-HTTP cookie fallback,
 * which is the documented exception for a non-HTTPS deployment.
 */
export const emailAndPasswordEnabled = true;
