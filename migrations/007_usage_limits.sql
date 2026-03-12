-- Function to reset monthly save counts on the 1st of each month
-- You'll call this via a Supabase cron job
create or replace function reset_monthly_saves()
returns void
language sql
as $$
  update users set saves_this_month = 0;
$$;

-- Function to increment save count and check limit
create or replace function increment_save_count(p_telegram_id text)
returns boolean -- returns true if allowed, false if limit reached
language plpgsql
as $$
declare
  v_count int;
  v_plan text;
begin
  select saves_this_month, plan into v_count, v_plan
  from users
  where telegram_id = p_telegram_id;

  -- Free tier: 100 saves/month, Pro: unlimited
  if v_plan = 'free' and v_count >= 100 then
    return false;
  end if;

  update users
  set saves_this_month = saves_this_month + 1,
      last_active = now()
  where telegram_id = p_telegram_id;

  return true;
end;
$$;