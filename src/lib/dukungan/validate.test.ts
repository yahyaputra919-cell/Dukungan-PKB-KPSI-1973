import assert from "node:assert/strict";
import test from "node:test";
import { cleanPersonName, isValidNik, maskNik, parseLines } from "./validate.ts";

test("NIK karyawan 10 digit diterima", () => {
  assert.equal(isValidNik("1234567890"), true);
  assert.equal(isValidNik("0987654321"), true);
});

test("NIK ditolak bila format salah", () => {
  assert.equal(isValidNik("3171011505900001"), false);
  assert.equal(isValidNik("123"), false);
  assert.equal(isValidNik("1111111111"), false);
  assert.equal(isValidNik("123456789"), false);
});

test("NIK disamarkan empat digit pertama", () => {
  assert.equal(maskNik("1234567890"), "1234******");
});

test("nama dibersihkan dan baris toko unik", () => {
  assert.equal(cleanPersonName("  Siti  Aminah "), "Siti Aminah");
  assert.equal(cleanPersonName("A"), null);
  assert.deepEqual(parseLines("Toko A\n toko a \n\nToko B"), ["Toko A", "Toko B"]);
});
