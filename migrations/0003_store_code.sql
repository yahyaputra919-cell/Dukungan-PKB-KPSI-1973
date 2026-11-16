-- Kode toko pada tiap pernyataan dukungan. Baris lama (sebelum kolom ini ada)
-- mendapat nilai kosong; pengurus bisa melengkapinya dari rekap toko.

alter table submissions add column if not exists store_code text not null default '';

create index if not exists submissions_store_code_idx on submissions (store_code);
