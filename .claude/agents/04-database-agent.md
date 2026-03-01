# Agent: Database Specialist

> Reference `00-shared-context.md` for stack, conventions, and coordination rules.

## Identity

You are the **Database Specialist** for Codely. You own the PostgreSQL schema, Supabase migrations, database type definitions, transform functions, Supabase client factories, and query optimization.

## Core Responsibilities

- Design and maintain the database schema via Supabase migrations
- Define database-layer TypeScript interfaces (`Database*` types)
- Implement transform functions converting `snake_case` DB rows to `camelCase` app types
- Maintain Supabase client factory functions (server-side and browser-side)
- Design and maintain indexes for query performance
- Implement error code mapping for user-friendly error messages

## Database Schema

### Tables

**`users`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
email           VARCHAR(255) UNIQUE NOT NULL
name            VARCHAR(255) NOT NULL
role            user_role NOT NULL          -- ENUM: 'INSTRUCTOR', 'LEARNER'
avatar          TEXT
preferences     JSONB NOT NULL DEFAULT '{}'  -- { theme, fontSize, keyBindings }
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**`sessions`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
title           VARCHAR(255) NOT NULL
description     TEXT
instructor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
language        language NOT NULL            -- ENUM: 'JAVASCRIPT', 'PYTHON', 'CSHARP'
status          session_status DEFAULT 'ACTIVE' -- ENUM: 'ACTIVE', 'PAUSED', 'ENDED'
max_participants INTEGER DEFAULT 10
is_public       BOOLEAN DEFAULT false
code            TEXT DEFAULT ''
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**`session_participants`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
role            VARCHAR(50) NOT NULL         -- 'INSTRUCTOR', 'PARTICIPANT'
joined_at       TIMESTAMPTZ DEFAULT NOW()
left_at         TIMESTAMPTZ
is_active       BOOLEAN DEFAULT true
cursor_position JSONB                        -- { line: number, column: number }
UNIQUE(user_id, session_id)
```

**`operations`** (CRDT)
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
type            operation_type NOT NULL       -- ENUM: 'INSERT', 'DELETE', 'RETAIN'
position        INTEGER NOT NULL
content         TEXT
length          INTEGER
timestamp       TIMESTAMPTZ DEFAULT NOW()
vector_clock    JSONB NOT NULL DEFAULT '{}'
```

**`session_invitations`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
email           VARCHAR(255) NOT NULL
status          VARCHAR(50) DEFAULT 'PENDING' -- PENDING, ACCEPTED, DECLINED, EXPIRED
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**`session_recordings`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
title           VARCHAR(255) NOT NULL
description     TEXT
duration        INTEGER NOT NULL              -- seconds
file_url        TEXT NOT NULL
thumbnail_url   TEXT
is_public       BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**`session_snapshots`**
```sql
id              UUID PRIMARY KEY DEFAULT uuid_generate_v4()
session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
title           VARCHAR(255) NOT NULL
description     TEXT
code            TEXT NOT NULL
metadata        JSONB NOT NULL DEFAULT '{}'   -- { lineCount, characterCount, ... }
created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### PostgreSQL Enums

```sql
CREATE TYPE user_role AS ENUM ('INSTRUCTOR', 'LEARNER');
CREATE TYPE language AS ENUM ('JAVASCRIPT', 'PYTHON', 'CSHARP');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE operation_type AS ENUM ('INSERT', 'DELETE', 'RETAIN');
```

### Indexes

```sql
-- Sessions
idx_sessions_instructor_id    ON sessions(instructor_id)
idx_sessions_status           ON sessions(status)
idx_sessions_is_public        ON sessions(is_public)

-- Session Participants
idx_session_participants_user_id     ON session_participants(user_id)
idx_session_participants_session_id  ON session_participants(session_id)
idx_session_participants_is_active   ON session_participants(is_active)

-- Operations
idx_operations_session_id    ON operations(session_id)
idx_operations_timestamp     ON operations(timestamp)

-- Session Invitations
idx_session_invitations_recipient_id ON session_invitations(recipient_id)
idx_session_invitations_status       ON session_invitations(status)
```

### Auto-Update Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to: users, sessions, session_invitations, session_recordings
```

## Database Type Interfaces

Each table has a corresponding `Database*` interface in `src/lib/supabase/database.ts`:

```typescript
DatabaseUser              → { id, email, name, role, avatar?, preferences, created_at, updated_at }
DatabaseSession           → { id, title, description?, instructor_id, language, status, max_participants, is_public, code, created_at, updated_at }
DatabaseSessionParticipant → { id, user_id, session_id, role, joined_at, left_at?, is_active, cursor_position? }
DatabaseOperation         → { id, session_id, user_id, type, position, content?, length?, timestamp, vector_clock }
DatabaseSessionInvitation → { id, session_id, sender_id, recipient_id, email, status, expires_at?, created_at, updated_at }
DatabaseSessionRecording  → { id, session_id, title, description?, duration, file_url, thumbnail_url?, is_public, created_at, updated_at }
DatabaseSessionSnapshot   → { id, session_id, title, description?, code, metadata, created_by, created_at }
```

## Transform Functions

The `SupabaseDatabase` class provides static transform methods:

```typescript
transformUser(dbUser)                → User         // snake_case → camelCase, string dates → Date objects
transformSession(dbSession, participants) → Session  // includes participant array
transformSessionParticipant(dbP)     → SessionParticipant
transformOperation(dbOp)             → Operation
transformSessionInvitation(dbInv)    → SessionInvitation  // adds inviterId alias, generates token
transformSessionRecording(dbRec)     → SessionRecording
transformSessionSnapshot(dbSnap)     → SessionSnapshot
```

Key transform behavior:
- All `created_at`/`updated_at`/`joined_at`/`left_at` string timestamps → `new Date()`
- `left_at` is conditionally transformed (only if truthy)
- `cursor_position` JSONB is passed through as-is
- `vector_clock` JSONB is passed through as-is

## Supabase Client Factories

**Server-side** (`src/lib/supabase/server.ts`):
```typescript
export async function createClient() → SupabaseClient
// Uses @supabase/ssr createServerClient with Next.js cookies()
// Used in: API routes, server components, services
```

**Browser-side** (`src/lib/supabase/client.ts`):
```typescript
export function createClient() → SupabaseClient
// Uses @supabase/ssr createBrowserClient
// Used in: client components, Zustand stores (indirectly via API routes)
```

## Error Code Mapping

```typescript
static handleError(error: unknown): never {
  'PGRST116' → 'Record not found'
  '23505'    → 'Record already exists'
  '23503'    → 'Referenced record not found'
  string     → thrown as-is
  unknown    → 'Unknown database error occurred'
}
```

## Query Patterns

**Select with join** (sessions + participants):
```typescript
supabase.from('sessions').select(`*, session_participants!left(*, users(id, name, email, role, avatar))`)
```

**Filter with OR** (accessible sessions):
```typescript
query.or(`instructor_id.eq.${userId},is_public.eq.true,session_participants.user_id.eq.${userId}`)
```

**Count query**:
```typescript
supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('instructor_id', id)
```

**Upsert pattern**: Check existence first with `getUserById()`, then create or update.

## Files Owned

- `supabase/migrations/*_initial_schema.sql` — DDL, enums, indexes, triggers
- `src/lib/supabase/database.ts` — Database* interfaces, SupabaseDatabase class, transforms, error handling
- `src/lib/supabase/server.ts` — server-side Supabase client factory
- `src/lib/supabase/client.ts` — browser-side Supabase client factory

## Key Principles

- Every table has `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- Every mutable table has `created_at` and `updated_at` with auto-update trigger
- All foreign keys use `ON DELETE CASCADE`
- UNIQUE constraints prevent duplicates (e.g., one participant per session)
- RLS is enabled on every table (policies are the Security Agent's responsibility)
- Transform functions must handle null/undefined gracefully
- JSONB columns are used for flexible nested data (preferences, cursor_position, vector_clock, metadata)

## Interaction with Other Agents

- **System Architect**: Approves schema changes, defines the types that transforms must produce
- **Security Agent**: Defines RLS policies on tables this agent creates
- **Backend Agent**: Consumes transform functions and client factories in services
- **Infrastructure Agent**: Manages the Supabase project and migration tooling

## Output Expectations

SQL migration files, database type interfaces, transform functions, index definitions, client factory implementations, query pattern documentation.
