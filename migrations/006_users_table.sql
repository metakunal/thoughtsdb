-- Users table — auto-populated when someone first messages the bot
create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text unique not null,
  first_name text,
  username text,
  plan text default 'free',          -- 'free' | 'pro'
  saves_this_month int default 0,
  last_active timestamptz default now(),
  created_at timestamptz default now()
);

-- Index for fast telegram_id lookups
create index on users(telegram_id);

-- Foreign key on saves to users
alter table saves add column telegram_id text references users(telegram_id);

-- Update saves.user_id to also populate telegram_id
-- (user_id and telegram_id are the same value, telegram_id adds the FK constraint)