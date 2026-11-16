-- Dukungan PKB. Pengunjung publik tidak punya akses baca lewat aplikasi:
-- server hanya mengizinkan insert + angka agregat. NIK disimpan terenkripsi.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  total_employees int check (total_employees is null or total_employees > 0),
  target_percent int not null default 50 check (target_percent between 1 and 100),
  statement_text text not null,
  consent_text text not null,
  contact_name text not null,
  contact_detail text not null,
  retention_note text not null,
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  id serial primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists stores_name_lower_idx on stores (lower(name));

create table if not exists positions (
  id serial primary key,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0
);

create unique index if not exists positions_name_lower_idx on positions (lower(name));

create table if not exists submissions (
  id text primary key,
  receipt_code text not null unique,
  full_name text not null,
  nik_hmac text not null unique,
  nik_cipher text not null,
  nik_mask text not null,
  store_name text not null,
  position_name text not null,
  signature_png text not null,
  consent_represent boolean not null,
  consent_text text not null,
  consent_member boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_at timestamptz not null default now()
);

create index if not exists submissions_created_idx on submissions (created_at desc);
create index if not exists submissions_store_idx on submissions (store_name);
create index if not exists submissions_status_idx on submissions (status);

create table if not exists admins (
  email text primary key,
  user_id text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id serial primary key,
  actor_user_id text not null,
  actor_email text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists rate_hits (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_hits_ip_idx on rate_hits (ip_hash, created_at);

insert into settings (
  id,
  total_employees,
  target_percent,
  statement_text,
  consent_text,
  contact_name,
  contact_detail,
  retention_note
)
select
  1,
  null,
  50,
  $stmt$Saya karyawan PT. Indomarco Prismatama. Dengan menandai kotak di bawah, saya memberi dukungan kepada PUK K-SPSI 1973 untuk mewakili saya dalam perundingan PKB.$stmt$,
  $consent$Saya menyatakan dukungan kepada PUK K-SPSI 1973 PT. Indomarco Prismatama untuk mewakili saya dalam perundingan PKB, dan menyetujui pemakaian data saya untuk keperluan tersebut.$consent$,
  $cname$Sekretaris Jenderal PUK K-SPSI 1973$cname$,
  $cdetail$[ISI NOMOR WHATSAPP ATAU EMAIL PENGURUS]$cdetail$,
  $retensi$Data disimpan hanya untuk pengumpulan dukungan dan lampiran resmi perundingan PKB. Pengurus menghapus data bila sudah tidak diperlukan, atau lebih cepat jika pemilik data meminta. Target internal pengurus: tidak menyimpan lebih dari 24 bulan setelah perundingan selesai. Jangka waktu yang paling tepat untuk pembuktian di Disnaker masih [PERLU VERIFIKASI].$retensi$
where not exists (select 1 from settings where id = 1);

insert into positions (name, sort_order)
select v.name, v.sort_order
from (
  values
    ('Kepala Toko', 1),
    ('Asisten Kepala Toko', 2),
    ('Pramuniaga', 3),
    ('Kasir', 4),
    ('Crew Toko', 5),
    ('Staff Gudang', 6),
    ('Staff Administrasi Toko', 7),
    ('Lainnya', 8)
) as v(name, sort_order)
where not exists (
  select 1 from positions p where lower(p.name) = lower(v.name)
);
