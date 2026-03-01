-- Codely Initial Schema Migration
-- Creates all tables, indexes, triggers, and RLS policies

-- ============================================================================
-- Helper: updated_at trigger function
-- ============================================================================
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Table: users
-- ============================================================================
create table users (
  id         uuid primary key,  -- matches auth.users.id
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
  before update on users
  for each row execute function handle_updated_at();

-- ============================================================================
-- Table: sessions
-- ============================================================================
create table sessions (
  id               uuid primary key default gen_random_uuid(),
  title            varchar(255) not null,
  description      text,
  instructor_id    uuid not null references users(id) on delete cascade,
  language         varchar(50) not null
                   check (language in ('JAVASCRIPT', 'PYTHON', 'CSHARP')),
  status           varchar(50) not null default 'ACTIVE'
                   check (status in ('ACTIVE', 'PAUSED', 'ENDED')),
  max_participants integer not null default 10
                   check (max_participants >= 2 and max_participants <= 50),
  is_public        boolean not null default false,
  code             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_sessions_instructor_id on sessions(instructor_id);
create index idx_sessions_status on sessions(status);
create index idx_sessions_created_at on sessions(created_at desc);

create trigger sessions_updated_at
  before update on sessions
  for each row execute function handle_updated_at();

-- ============================================================================
-- Table: session_participants
-- ============================================================================
create table session_participants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  session_id      uuid not null references sessions(id) on delete cascade,
  role            varchar(50) not null default 'LEARNER'
                  check (role in ('INSTRUCTOR', 'LEARNER', 'OBSERVER')),
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  is_active       boolean not null default true,
  cursor_position jsonb,

  unique (user_id, session_id)
);

create index idx_session_participants_session_id on session_participants(session_id);
create index idx_session_participants_user_id on session_participants(user_id);
create index idx_session_participants_active on session_participants(session_id)
  where is_active = true;

-- ============================================================================
-- Table: session_snapshots
-- ============================================================================
create table session_snapshots (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  title       varchar(255) not null,
  description text,
  code        text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index idx_session_snapshots_session_id on session_snapshots(session_id, created_at desc);

-- ============================================================================
-- Table: session_invitations
-- ============================================================================
create table session_invitations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  sender_id    uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
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

create index idx_session_invitations_session_id on session_invitations(session_id);
create index idx_session_invitations_recipient on session_invitations(recipient_id);
create index idx_session_invitations_token on session_invitations(token);

create trigger session_invitations_updated_at
  before update on session_invitations
  for each row execute function handle_updated_at();

-- ============================================================================
-- Table: operations (CRDT operation log)
-- ============================================================================
create table operations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  type         varchar(50) not null
               check (type in ('INSERT', 'DELETE', 'RETAIN')),
  position     integer not null,
  content      text,
  length       integer,
  timestamp    timestamptz not null default now(),
  vector_clock jsonb not null default '{}'::jsonb
);

create index idx_operations_session_id on operations(session_id, timestamp);
create index idx_operations_user_id on operations(user_id);

-- ============================================================================
-- Table: session_recordings
-- ============================================================================
create table session_recordings (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  title         varchar(255) not null,
  description   text,
  duration      integer not null default 0,
  file_url      varchar(1024) not null,
  thumbnail_url varchar(1024),
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_session_recordings_session_id on session_recordings(session_id);

create trigger session_recordings_updated_at
  before update on session_recordings
  for each row execute function handle_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table users enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;
alter table session_snapshots enable row level security;
alter table session_invitations enable row level security;
alter table operations enable row level security;
alter table session_recordings enable row level security;

-- ── users ──────────────────────────────────────────────────────────────────
create policy "users_select" on users
  for select to authenticated using (true);

create policy "users_insert" on users
  for insert to authenticated with check (id = auth.uid());

create policy "users_update" on users
  for update to authenticated using (id = auth.uid());

create policy "users_delete" on users
  for delete to authenticated using (id = auth.uid());

-- ── sessions ───────────────────────────────────────────────────────────────
create policy "sessions_select" on sessions
  for select to authenticated using (true);

create policy "sessions_insert" on sessions
  for insert to authenticated with check (instructor_id = auth.uid());

create policy "sessions_update" on sessions
  for update to authenticated using (instructor_id = auth.uid());

create policy "sessions_delete" on sessions
  for delete to authenticated using (instructor_id = auth.uid());

-- ── session_participants ───────────────────────────────────────────────────
create policy "session_participants_select" on session_participants
  for select to authenticated using (true);

create policy "session_participants_insert" on session_participants
  for insert to authenticated with check (user_id = auth.uid());

create policy "session_participants_update" on session_participants
  for update to authenticated using (
    user_id = auth.uid()
    or session_id in (
      select id from sessions where instructor_id = auth.uid()
    )
  );

create policy "session_participants_delete" on session_participants
  for delete to authenticated using (
    user_id = auth.uid()
    or session_id in (
      select id from sessions where instructor_id = auth.uid()
    )
  );

-- ── session_snapshots ──────────────────────────────────────────────────────
create policy "session_snapshots_select" on session_snapshots
  for select to authenticated using (true);

create policy "session_snapshots_insert" on session_snapshots
  for insert to authenticated with check (created_by = auth.uid());

create policy "session_snapshots_delete" on session_snapshots
  for delete to authenticated using (created_by = auth.uid());

-- ── session_invitations ────────────────────────────────────────────────────
create policy "session_invitations_select" on session_invitations
  for select to authenticated using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

create policy "session_invitations_insert" on session_invitations
  for insert to authenticated with check (sender_id = auth.uid());

create policy "session_invitations_update" on session_invitations
  for update to authenticated using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

create policy "session_invitations_delete" on session_invitations
  for delete to authenticated using (sender_id = auth.uid());

-- ── operations ─────────────────────────────────────────────────────────────
create policy "operations_select" on operations
  for select to authenticated using (true);

create policy "operations_insert" on operations
  for insert to authenticated with check (user_id = auth.uid());

-- ── session_recordings ─────────────────────────────────────────────────────
create policy "session_recordings_select" on session_recordings
  for select to authenticated using (true);

create policy "session_recordings_insert" on session_recordings
  for insert to authenticated with check (
    session_id in (
      select id from sessions where instructor_id = auth.uid()
    )
  );

create policy "session_recordings_update" on session_recordings
  for update to authenticated using (
    session_id in (
      select id from sessions where instructor_id = auth.uid()
    )
  );

create policy "session_recordings_delete" on session_recordings
  for delete to authenticated using (
    session_id in (
      select id from sessions where instructor_id = auth.uid()
    )
  );

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table session_participants;
