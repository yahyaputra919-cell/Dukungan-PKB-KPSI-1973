import assert from "node:assert/strict";
import test from "node:test";

process.env.NIK_ENCRYPTION_KEY = "uji-kunci-nik-panjang";

test("NIK terenkripsi bisa dibuka kembali dan tidak tersimpan polos", async () => {
  const { decryptNik, encryptNik } = await import("./crypto.server.ts");
  const cipher = encryptNik("3171011505900001");
  assert.equal(cipher.includes("3171011505900001"), false);
  assert.equal(decryptNik(cipher), "3171011505900001");
});

test("pertanyaan keamanan menolak jawaban tergesa dan menerima yang benar", async () => {
  const { issueChallenge, verifyChallenge } = await import("./crypto.server.ts");
  const challenge = issueChallenge();
  assert.equal(verifyChallenge(challenge.token, String(challenge.a + challenge.b)), "bad");
  await new Promise((resolve) => setTimeout(resolve, 2600));
  assert.equal(verifyChallenge(challenge.token, String(challenge.a + challenge.b)), "ok");
  assert.equal(verifyChallenge(challenge.token, "0"), "bad");
});
