-- 010_fix_rls_policies.sql

-- Allow service role full access to users table
create policy "Service role full access to users"
  on users for all
  using (true)
  with check (true);

-- Allow service role full access to saves
create policy "Service role full access to saves"
  on saves for all
  using (true)
  with check (true);