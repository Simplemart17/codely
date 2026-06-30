-- Codely — Initial Schema
-- Every object lives in a dedicated `codely` schema so this app can share a
-- database with other applications without colliding in `public`.
-- Tables, indexes, triggers, RLS policies, role grants, and realtime are all
-- scoped to that schema. This is the single source of truth for a fresh project.

-- ============================================================================
-- Schema
-- ============================================================================
create schema if not exists codely;

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================
-- search_path is pinned to '' so the function resolves objects via fully
-- qualified names only (satisfies Supabase's "function_search_path_mutable"
-- advisor). now() lives in pg_catalog, which is always implicitly available.
create or replace function codely.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Table: users
-- ============================================================================
-- Mirrors auth.users (id is the auth user id). The FK keeps the profile row in
-- sync with the auth account and cascades deletes when the account is removed.
create table codely.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      varchar(255) not null unique,
  name       varchar(255) not null,
  role       varchar(50)  not null default 'LEARNER'
             check (role in ('INSTRUCTOR', 'LEARNER')),
  avatar     text,
  preferences jsonb not null default '{
    "theme": "light",
    "fontSize": 14,
    "keyBindings": "vscode"
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at
  before update on codely.users
  for each row execute function codely.handle_updated_at();

-- ============================================================================
-- Table: sessions
-- ============================================================================
create table codely.sessions (
  id               uuid primary key default gen_random_uuid(),
  title            varchar(255) not null,
  description      text,
  instructor_id    uuid not null references codely.users(id) on delete cascade,
  language         varchar(50) not null
                   check (language in ('JAVASCRIPT', 'PYTHON')),
  status           varchar(50) not null default 'ACTIVE'
                   check (status in ('ACTIVE', 'PAUSED', 'ENDED')),
  max_participants integer not null default 10
                   check (max_participants >= 2 and max_participants <= 50),
  is_public        boolean not null default false,
  code             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_sessions_instructor_id on codely.sessions(instructor_id);
create index idx_sessions_status on codely.sessions(status);
create index idx_sessions_created_at on codely.sessions(created_at desc);

create trigger sessions_updated_at
  before update on codely.sessions
  for each row execute function codely.handle_updated_at();

-- ============================================================================
-- Table: session_participants
-- ============================================================================
create table codely.session_participants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references codely.users(id) on delete cascade,
  session_id      uuid not null references codely.sessions(id) on delete cascade,
  role            varchar(50) not null default 'LEARNER'
                  check (role in ('INSTRUCTOR', 'LEARNER', 'OBSERVER')),
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  is_active       boolean not null default true,
  cursor_position jsonb,

  unique (user_id, session_id)
);

create index idx_session_participants_session_id on codely.session_participants(session_id);
create index idx_session_participants_user_id on codely.session_participants(user_id);
create index idx_session_participants_active on codely.session_participants(session_id)
  where is_active = true;

-- ============================================================================
-- Table: session_snapshots
-- ============================================================================
create table codely.session_snapshots (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references codely.sessions(id) on delete cascade,
  title       varchar(255) not null,
  description text,
  code        text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid not null references codely.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index idx_session_snapshots_session_id on codely.session_snapshots(session_id, created_at desc);

-- ============================================================================
-- Table: session_invitations
-- ============================================================================
create table codely.session_invitations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references codely.sessions(id) on delete cascade,
  sender_id    uuid not null references codely.users(id) on delete cascade,
  recipient_id uuid not null references codely.users(id) on delete cascade,
  email        varchar(255) not null,
  role         varchar(50) not null default 'LEARNER'
               check (role in ('INSTRUCTOR', 'LEARNER', 'OBSERVER')),
  status       varchar(50) not null default 'PENDING'
               check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  token        varchar(255) unique,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_session_invitations_session_id on codely.session_invitations(session_id);
create index idx_session_invitations_recipient on codely.session_invitations(recipient_id);
create index idx_session_invitations_token on codely.session_invitations(token);

create trigger session_invitations_updated_at
  before update on codely.session_invitations
  for each row execute function codely.handle_updated_at();

-- ============================================================================
-- Table: operations (CRDT operation log)
-- ============================================================================
create table codely.operations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references codely.sessions(id) on delete cascade,
  user_id      uuid not null references codely.users(id) on delete cascade,
  type         varchar(50) not null
               check (type in ('INSERT', 'DELETE', 'RETAIN')),
  position     integer not null,
  content      text,
  length       integer,
  timestamp    timestamptz not null default now(),
  vector_clock jsonb not null default '{}'::jsonb
);

create index idx_operations_session_id on codely.operations(session_id, timestamp);
create index idx_operations_user_id on codely.operations(user_id);

-- ============================================================================
-- Table: session_recordings
-- ============================================================================
create table codely.session_recordings (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references codely.sessions(id) on delete cascade,
  title         varchar(255) not null,
  description   text,
  duration      integer not null default 0,
  file_url      varchar(1024) not null,
  thumbnail_url varchar(1024),
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_session_recordings_session_id on codely.session_recordings(session_id);

create trigger session_recordings_updated_at
  before update on codely.session_recordings
  for each row execute function codely.handle_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table codely.users enable row level security;
alter table codely.sessions enable row level security;
alter table codely.session_participants enable row level security;
alter table codely.session_snapshots enable row level security;
alter table codely.session_invitations enable row level security;
alter table codely.operations enable row level security;
alter table codely.session_recordings enable row level security;

-- ── users ──────────────────────────────────────────────────────────────────
create policy "users_select" on codely.users
  for select to authenticated using (true);

create policy "users_insert" on codely.users
  for insert to authenticated with check (id = auth.uid());

create policy "users_update" on codely.users
  for update to authenticated using (id = auth.uid());

create policy "users_delete" on codely.users
  for delete to authenticated using (id = auth.uid());

-- ── sessions ───────────────────────────────────────────────────────────────
create policy "sessions_select" on codely.sessions
  for select to authenticated using (true);

create policy "sessions_insert" on codely.sessions
  for insert to authenticated with check (instructor_id = auth.uid());

create policy "sessions_update" on codely.sessions
  for update to authenticated using (instructor_id = auth.uid());

create policy "sessions_delete" on codely.sessions
  for delete to authenticated using (instructor_id = auth.uid());

-- ── session_participants ───────────────────────────────────────────────────
create policy "session_participants_select" on codely.session_participants
  for select to authenticated using (true);

create policy "session_participants_insert" on codely.session_participants
  for insert to authenticated with check (user_id = auth.uid());

create policy "session_participants_update" on codely.session_participants
  for update to authenticated using (
    user_id = auth.uid()
    or session_id in (
      select id from codely.sessions where instructor_id = auth.uid()
    )
  );

create policy "session_participants_delete" on codely.session_participants
  for delete to authenticated using (
    user_id = auth.uid()
    or session_id in (
      select id from codely.sessions where instructor_id = auth.uid()
    )
  );

-- ── session_snapshots ──────────────────────────────────────────────────────
create policy "session_snapshots_select" on codely.session_snapshots
  for select to authenticated using (true);

create policy "session_snapshots_insert" on codely.session_snapshots
  for insert to authenticated with check (created_by = auth.uid());

create policy "session_snapshots_delete" on codely.session_snapshots
  for delete to authenticated using (created_by = auth.uid());

-- ── session_invitations ────────────────────────────────────────────────────
create policy "session_invitations_select" on codely.session_invitations
  for select to authenticated using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

create policy "session_invitations_insert" on codely.session_invitations
  for insert to authenticated with check (sender_id = auth.uid());

create policy "session_invitations_update" on codely.session_invitations
  for update to authenticated using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

create policy "session_invitations_delete" on codely.session_invitations
  for delete to authenticated using (sender_id = auth.uid());

-- ── operations ─────────────────────────────────────────────────────────────
create policy "operations_select" on codely.operations
  for select to authenticated using (true);

create policy "operations_insert" on codely.operations
  for insert to authenticated with check (user_id = auth.uid());

-- ── session_recordings ─────────────────────────────────────────────────────
create policy "session_recordings_select" on codely.session_recordings
  for select to authenticated using (true);

create policy "session_recordings_insert" on codely.session_recordings
  for insert to authenticated with check (
    session_id in (
      select id from codely.sessions where instructor_id = auth.uid()
    )
  );

create policy "session_recordings_update" on codely.session_recordings
  for update to authenticated using (
    session_id in (
      select id from codely.sessions where instructor_id = auth.uid()
    )
  );

create policy "session_recordings_delete" on codely.session_recordings
  for delete to authenticated using (
    session_id in (
      select id from codely.sessions where instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- Grants — expose the schema to the Supabase API roles
-- ============================================================================
-- PostgREST connects as anon / authenticated; service_role is used server-side.
-- These grants make the schema reachable; RLS (above) still governs row access.
-- Also add `codely` to the API's exposed schemas (Dashboard → API → Exposed
-- schemas, or `[api] schemas` in supabase/config.toml) so PostgREST serves it.
grant usage on schema codely to anon, authenticated, service_role;

grant all on all tables    in schema codely to anon, authenticated, service_role;
grant all on all routines  in schema codely to anon, authenticated, service_role;
grant all on all sequences in schema codely to anon, authenticated, service_role;

-- Apply the same grants to anything created in this schema later.
alter default privileges for role postgres in schema codely
  grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema codely
  grant all on routines  to anon, authenticated, service_role;
alter default privileges for role postgres in schema codely
  grant all on sequences to anon, authenticated, service_role;

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table codely.sessions;
alter publication supabase_realtime add table codely.session_participants;
