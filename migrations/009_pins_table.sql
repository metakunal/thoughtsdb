-- 009_pins_table.sql
create table pins (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  pin text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
create index on pins(pin);