-- Codely — Seed data
-- Runs automatically on `supabase db reset` (and can be run by hand in the
-- SQL Editor). Idempotent: re-running skips any instructor that already exists.
--
-- Creates a full instructor login = an auth account + matching codely.users
-- profile flagged role = 'INSTRUCTOR'. codely.users.id is a FK to auth.users(id),
-- so both rows are required.
--
-- NOTE: this writes directly to auth.* (works because the SQL Editor / CLI runs
-- as a superuser). It is intended for LOCAL / development databases. Change the
-- credentials below before using anywhere real.

do $$
declare
  v_email    text := 'codely@simplemart.dev';
  v_password text := 'ChangeMe123!';
  v_name     text := 'Simplemart';
  v_user_id  uuid := gen_random_uuid();
begin
  -- Skip if this email already has an auth account (keeps `db reset` safe to repeat).
  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'Instructor % already exists — skipping.', v_email;
    return;
  end if;

  -- 1) Auth account
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(v_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_name),
    '', '', '', ''
  );

  -- 2) Email identity (required for email/password sign-in)
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- 3) Codely profile, flagged as instructor
  insert into codely.users (id, email, name, role)
  values (v_user_id, v_email, v_name, 'INSTRUCTOR');

  raise notice 'Created instructor % (%)', v_email, v_user_id;
end $$;
