import assert from "node:assert/strict";
import test from "node:test";
import { cleanPersonName, isValidNik, maskNik, parseLines } from "./validate.ts";

test("NIK 16 digit dengan tanggal lahir valid", () => {
  assert.equal(isValidNik("3171011505900001"), true);
  assert.equal(isValidNik("3171015505900001"), true);
});

test("NIK ditolak bila format atau tanggal salah", () => {
  assert.equal(isValidNik("3171013201900001"), false);
  assert.equal(isValidNik("123"), false);
  assert.equal(isValidNik("1111111111111111"), false);
  assert.equal(isValidNik("317101150590000"), false);
});

test("NIK disamarkan empat digit pertama", () => {
  assert.equal(maskNik("3171011505900001"), "3171************");
});

test("nama dibersihkan dan baris toko unik", () => {
  assert.equal(cleanPersonName("  Siti  Aminah "), "Siti Aminah");
  assert.equal(cleanPersonName("A"), null);
  assert.deepEqual(parseLines("Toko A\n toko a \n\nToko B"), ["Toko A", "Toko B"]);
});
