-- Codely — Seed data
-- Runs automatically on `supabase db reset` (or by hand in the SQL Editor).
--
-- Auth is handled by Clerk, so there is NO Supabase auth account to create here.
-- codely.users.id IS the Clerk user id (the JWT `sub` that RLS matches on).
--
-- To seed an INSTRUCTOR:
--   1. Create the user in Clerk (Dashboard -> Users, or just sign up in the app).
--   2. Copy their Clerk user id (looks like "user_2ab...").
--   3. Set v_user_id below and run this.
-- Idempotent: re-running upserts the row and (re)flags it INSTRUCTOR.

do $$
declare
  -- Replace with the Clerk user id of your instructor account.
  v_user_id text := 'user_REPLACE_WITH_CLERK_ID';
  v_email   text := 'codely@simplemart.dev';
  v_name    text := 'Simplemart';
begin
  if v_user_id = 'user_REPLACE_WITH_CLERK_ID' then
    raise notice 'Seed skipped: set v_user_id to a real Clerk user id first.';
    return;
  end if;

  insert into codely.users (id, email, name, role)
  values (v_user_id, v_email, v_name, 'INSTRUCTOR')
  on conflict (id) do update
    set role = 'INSTRUCTOR',
        name = excluded.name,
        email = excluded.email;

  raise notice 'Seeded instructor % (%)', v_email, v_user_id;
end $$;
