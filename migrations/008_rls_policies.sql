-- Enable Row Level Security on saves
alter table saves enable row level security;
alter table users enable row level security;

-- Users can only read their own saves
create policy "Users can read own saves"
  on saves for select
  using (user_id = current_setting('app.current_user_id', true));

-- Users can only read their own profile
create policy "Users can read own profile"
  on users for select
  using (telegram_id = current_setting('app.current_user_id', true));

-- Service role bypasses RLS entirely (your bot and server components use service key)